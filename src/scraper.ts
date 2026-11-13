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

const CFTC_SOCRATA_RESOURCE_URL = 'https://publicreporting.cftc.gov/resource/6dca-aqww.json';

function parseCleanInt(value: string | number | undefined | null): number {
    if (value === undefined || value === null) return 0;
    const cleaned = String(value).replace(/,/g, '').trim();
    const parsed = parseInt(cleaned, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

async function fetchSocrataForYear(
    year: number,
    contractCodes: string[]
): Promise<Array<Record<string, string>>> {
    const safeCodes = Array.from(
        new Set(contractCodes.map((c) => c.replace(/[^A-Za-z0-9]/g, '')).filter(Boolean))
    ).sort();

    const clauses: string[] = [
        `report_date_as_yyyy_mm_dd >= '${year}-01-01T00:00:00'`,
        `report_date_as_yyyy_mm_dd < '${year + 1}-01-01T00:00:00'`,
    ];
    if (safeCodes.length > 0) {
        const inList = safeCodes.map((c) => `'${c}'`).join(',');
        clauses.unshift(`cftc_contract_market_code in (${inList})`);
    }

    const whereExpr = clauses.join(' AND ');
    const pageSize = 5000;
    let offset = 0;
    const rows: Array<Record<string, string>> = [];

    log.info(`Fetching CFTC COT data for year ${year} via official CFTC Socrata Open Data API...`);

    while (true) {
        const params = new URLSearchParams({
            $where: whereExpr,
            $order: 'report_date_as_yyyy_mm_dd DESC, cftc_contract_market_code ASC',
            $limit: String(pageSize),
            $offset: String(offset),
        });
        const url = `${CFTC_SOCRATA_RESOURCE_URL}?${params.toString()}`;
        const resp = await fetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            },
        });
        if (!resp.ok) {
            throw new Error(`CFTC Socrata API HTTP ${resp.status}`);
        }
        const batch = (await resp.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(batch)) {
            throw new Error('Unexpected Socrata API response format');
        }
        for (const r of batch) {
            rows.push({
                'CFTC Contract Market Code': String(r.cftc_contract_market_code ?? '').trim(),
                'As of Date in Form YYYY-MM-DD': String(r.report_date_as_yyyy_mm_dd ?? '').slice(0, 10),
                'Noncommercial Positions-Long (All)': String(r.noncomm_positions_long_all ?? '0'),
                'Noncommercial Positions-Short (All)': String(r.noncomm_positions_short_all ?? '0'),
                'Change in Noncommercial-Long (All)': String(r.change_in_noncomm_long_all ?? '0'),
                'Change in Noncommercial-Short (All)': String(r.change_in_noncomm_short_all ?? '0'),
            });
        }
        if (batch.length < pageSize) {
            break;
        }
        offset += pageSize;
    }

    log.info(`Loaded ${rows.length} CFTC COT rows for year ${year} via CFTC Socrata Open Data API.`);
    return rows;
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

    const contractCodes = targetAssets.map((a) => a.code);
    const allParsedRows: Array<Record<string, string>> = [];

    for (const year of years) {
        const url = `https://www.cftc.gov/files/dea/history/deacot${year}.zip`;
        log.info(`Downloading CFTC COT reports for year ${year} from ${url}...`);

        let zipLoaded = false;
        try {
            const response = await fetch(url, {
                headers: {
                    Referer: 'https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalViewable/index.htm',
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                },
            });
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buf = Buffer.from(arrayBuffer);
                const head = buf.subarray(0, 128).toString('utf8').trimStart().toLowerCase();
                if (!head.startsWith('<!doctype') && !head.startsWith('<html')) {
                    const zip = new AdmZip(buf);
                    const zipEntries = zip.getEntries();

                    const targetEntry = zipEntries.find(
                        (entry) => entry.entryName.endsWith('.txt') || entry.entryName.endsWith('.csv')
                    );

                    if (targetEntry) {
                        const rawText = targetEntry.getData().toString('utf8');
                        const parsedRecords = parse(rawText, {
                            columns: (header: string[]) =>
                                header.map((col) => col.trim().replace(/^["']|["']$/g, '')),
                            skip_empty_lines: true,
                            trim: true,
                            relax_column_count: true,
                        }) as Array<Record<string, string>>;

                        allParsedRows.push(...parsedRecords);
                        zipLoaded = true;
                        log.info(`Successfully parsed ${parsedRecords.length} raw rows from year ${year}.`);
                    } else {
                        log.warning(`No CSV or TXT file found inside deacot${year}.zip`);
                    }
                }
            } else {
                log.warning(`Failed to download COT ZIP data for ${year}: HTTP ${response.status}`);
            }
        } catch (err) {
            log.warning(`Error downloading or processing ZIP for year ${year}: ${err}`);
        }

        if (!zipLoaded) {
            try {
                const socrataRows = await fetchSocrataForYear(year, contractCodes);
                allParsedRows.push(...socrataRows);
            } catch (apiErr) {
                log.error(`Failed to retrieve COT data for year ${year} from Socrata fallback: ${apiErr}`);
            }
        }
    }

    const assetRecordsMap = new Map<string, CotRecord[]>();
    const flatRecords: CotRecord[] = [];

    for (const asset of targetAssets) {
        const matchingRows = allParsedRows.filter((row) => {
            const marketCode = (row['CFTC Contract Market Code'] || '').trim().replace(/^["']|["']$/g, '');
            return marketCode === asset.code || marketCode.includes(asset.code);
        });

        if (matchingRows.length === 0) {
            continue;
        }

        const assetRecords: CotRecord[] = [];

        for (const row of matchingRows) {
            const rawDate = row['As of Date in Form YYYY-MM-DD'] || '';
            const longPos = parseCleanInt(row['Noncommercial Positions-Long (All)']);
            const shortPos = parseCleanInt(row['Noncommercial Positions-Short (All)']);
            const chgLong = parseCleanInt(row['Change in Noncommercial-Long (All)']);
            const chgShort = parseCleanInt(row['Change in Noncommercial-Short (All)']);
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
