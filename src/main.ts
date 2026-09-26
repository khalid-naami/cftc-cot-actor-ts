import { Actor, log } from 'apify';
import { downloadAndParseCftcReports } from './scraper.js';
import { calculateOrderflowRankings } from './metrics.js';

interface ActorInput {
    assets?: string[];
    categories?: string[];
    years?: number[];
    includeRankings?: boolean;
    outputFormat?: 'flat_records' | 'aggregated_by_asset';
}

await Actor.init();

try {
    const input = (await Actor.getInput<ActorInput>()) || {};

    const currentYear = new Date().getFullYear();
    const defaultYears = [currentYear - 1, currentYear];

    const selectedAssets = input.assets && input.assets.length > 0 ? input.assets : ['ALL'];
    const selectedCategories = input.categories && input.categories.length > 0 ? input.categories : ['ALL'];
    const selectedYears = input.years && input.years.length > 0 ? input.years : defaultYears;
    const includeRankings = input.includeRankings ?? true;
    const outputFormat = input.outputFormat ?? 'flat_records';

    log.info(
        `Starting TypeScript CFTC COT Actor (assets: ${selectedAssets.join(',')}, years: ${selectedYears.join(',')})`
    );

    // 1. Fetch & Parse CFTC data
    const { assetRecordsMap, flatRecords } = await downloadAndParseCftcReports(
        selectedYears,
        selectedAssets,
        selectedCategories
    );

    if (flatRecords.length === 0) {
        log.warning('No CFTC COT records were extracted. Please verify the requested filters.');
        await Actor.exit({ exitCode: 0 });
    }

    log.info(`Successfully parsed ${flatRecords.length} records across ${assetRecordsMap.size} assets.`);

    // 2. Compute Smart Money Rankings
    if (includeRankings && assetRecordsMap.size > 0) {
        log.info('Computing Smart Money Orderflow Rankings...');
        const rankingsData = calculateOrderflowRankings(assetRecordsMap);
        await Actor.setValue('ORDERFLOW_RANKINGS', rankingsData);
        log.info('Saved ORDERFLOW_RANKINGS into Key-Value Store.');
    }

    // 3. Save to Apify Dataset
    if (outputFormat === 'aggregated_by_asset') {
        const aggregated: Array<Record<string, unknown>> = [];
        for (const [assetName, records] of assetRecordsMap.entries()) {
            aggregated.push({
                asset: assetName,
                category: records[0]?.category || 'other',
                latest_date: records[0]?.date || '',
                total_reports: records.length,
                history: records,
            });
        }
        await Actor.pushData(aggregated);
        log.info(`Pushed ${aggregated.length} aggregated asset groups to Apify Dataset.`);
    } else {
        await Actor.pushData(flatRecords);
        log.info(`Pushed ${flatRecords.length} flat records to Apify Dataset.`);
    }

    // 4. Save Run Summary to Key-Value Store
    await Actor.setValue('OUTPUT', {
        status: 'SUCCESS',
        runtime: 'TypeScript/Node.js',
        total_records: flatRecords.length,
        assets_count: assetRecordsMap.size,
        years_processed: selectedYears,
        rankings_included: includeRankings,
    });

    log.info('Actor run completed successfully.');
} catch (error) {
    log.error(`Actor failed with error: ${error}`);
    throw error;
}

await Actor.exit();
