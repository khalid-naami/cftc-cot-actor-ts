/**
 * Async COT Report Downloader and Parser for Node.js / TypeScript.
 */
import AdmZip from 'adm-zip';
import { parse } from 'csv-parse/sync';
import { Actor, log } from 'apify';
import { ALL_ASSETS, AssetConfig } from './constants.js';
import { CotRecord } from './metrics.js';

export interface ScraperResult {
    assetRecordsMap: Map<string, CotRecord[]>;
    flatRecords: CotRecord[];
}

export async function downloadAndParseCftcReports(
    years: number[],
    selectedAssets?: string[],
    selectedCategories?: string[]
): Promise<ScraperResult> {
    let targetAssets: AssetConfig[] = ALL_ASSETS;

    if (selectedAssets && selectedAssets.length > 0 && !selectedAssets.includes('ALL')) {
        targetAssets = targetAssets.filter((a) => selectedAssets.includes(a.name));
    }

    if (selectedCategories && selectedCategories.length > 0 && !selectedCategories.includes('ALL')) {
        targetAssets = targetAssets.filter((a) => selectedCategories.includes(a.category));
    }

    const allParsedRows: Array<Record<string, string>> = [];

    for (const year of years) {
        const url = `https://www.cftc.gov/files/dea/history/deacot${year}.zip`;
        log.info(`Downloading CFTC COT reports for year ${year} from ${url}...`);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                log.warning(`Failed to download COT data for ${year}: HTTP ${response.status}`);
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const zip = new AdmZip(Buffer.from(arrayBuffer));
            const zipEntries = zip.getEntries();

            const targetEntry = zipEntries.find((entry) =>
                entry.entryName.endsWith('.txt') || entry.entryName.endsWith('.csv')
            );

            if (!targetEntry) {
                log.warning(`No CSV or TXT file found inside deacot${year}.zip`);
                continue;
            }

            const rawText = targetEntry.getData().toString('utf8');
            const parsedRecords = parse(rawText, {
                columns: (header: string[]) => header.map((col) => col.trim().replace(/^["']|["']$/g, '')),
                skip_empty_lines: true,
                trim: true,
                relax_column_count: true,
            }) as Array<Record<string, string>>;

            allParsedRows.push(...parsedRecords);
            log.info(`Successfully parsed ${parsedRecords.length} raw rows from year ${year}.`);
        } catch (err) {
            log.error(`Error downloading or processing year ${year}: ${err}`);
        }
    }

    const assetRecordsMap = new Map<string, CotRecord[]>();
    const flatRecords: CotRecord[] = [];

    for (const asset of targetAssets) {
        const matchingRows = allParsedRows.filter((row) => {
            const marketCode = row['CFTC Contract Market Code'] || '';
            return marketCode.includes(asset.code);
        });

        if (matchingRows.length === 0) {
            continue;
        }

        const assetRecords: CotRecord[] = [];

        for (const row of matchingRows) {
            const rawDate = row['As of Date in Form YYYY-MM-DD'] || '';
            const longPos = parseInt(row['Noncommercial Positions-Long (All)'] || '0', 10) || 0;
            const shortPos = parseInt(row['Noncommercial Positions-Short (All)'] || '0', 10) || 0;
            const chgLong = parseInt(row['Change in Noncommercial-Long (All)'] || '0', 10) || 0;
            const chgShort = parseInt(row['Change in Noncommercial-Short (All)'] || '0', 10) || 0;
            const netPos = longPos - shortPos;

            // Format date to DD/MM/YY
            let formattedDate = rawDate;
            if (rawDate.includes('-')) {
                const parts = rawDate.split('-');
                if (parts.length === 3) {
                    const yearShort = parts[0].slice(-2);
                    formattedDate = `${parts[2]}/${parts[1]}/${yearShort}`;
                }
            }

            const record: CotRecord = {
                date: formattedDate,
                iso_date: rawDate,
                asset: asset.name,
                category: asset.category,
                contract_code: asset.code,
                long_positions: longPos,
                short_positions: shortPos,
                change_long: chgLong,
                change_short: chgShort,
                net_position: netPos,
                report_id: asset.reportId,
            };

            assetRecords.push(record);
        }

        // Sort descending by date (newest first)
        assetRecords.sort((a, b) => b.iso_date.localeCompare(a.iso_date));

        // Deduplicate dates if needed
        const seenDates = new Set<string>();
        const uniqueAssetRecords: CotRecord[] = [];
        for (const rec of assetRecords) {
            if (!seenDates.has(rec.date)) {
                seenDates.add(rec.date);
                uniqueAssetRecords.push(rec);
            }
        }

        assetRecordsMap.set(asset.name, uniqueAssetRecords);
        flatRecords.push(...uniqueAssetRecords);
    }

    return { assetRecordsMap, flatRecords };
}
