/**
 * Smart Money Orderflow & Institutional Ranking Engine in TypeScript.
 */

export interface CotRecord {
    date: string;
    iso_date: string;
    asset: string;
    category: string;
    contract_code: string;
    long_positions: number;
    short_positions: number;
    change_long: number;
    change_short: number;
    net_position: number;
    report_id: string;
}

export interface RankingItem {
    asset: string;
    rank: number;
    orderflow_value: number;
    date: string;
    direction: 'LONG' | 'SHORT';
}

export interface OrderflowRankings {
    bullish_rankings: RankingItem[];
    bearish_rankings: RankingItem[];
}

export function calculateOrderflowRankings(assetRecordsMap: Map<string, CotRecord[]>): OrderflowRankings {
    const bullish: RankingItem[] = [];
    const bearish: RankingItem[] = [];

    for (const [assetName, records] of assetRecordsMap.entries()) {
        if (!records || records.length === 0) continue;

        const result = computeAssetRank(records);
        if (!result) continue;

        const item: RankingItem = {
            asset: assetName,
            rank: result.rank,
            orderflow_value: Math.round(result.value),
            date: result.date,
            direction: result.value >= 0 ? 'LONG' : 'SHORT',
        };

        if (result.value >= 0) {
            bullish.push(item);
        } else {
            bearish.push(item);
        }
    }

    // Sort by rank ascending (rank 1 is best)
    bullish.sort((a, b) => a.rank - b.rank);
    bearish.sort((a, b) => a.rank - b.rank);

    return {
        bullish_rankings: bullish,
        bearish_rankings: bearish,
    };
}

interface RankCalculation {
    rank: number;
    value: number;
    date: string;
}

function computeAssetRank(records: CotRecord[]): RankCalculation | null {
    const listRankLong: Array<[number, number, string]> = [];
    const listRankShort: Array<[number, number, string]> = [];
    let lastChange = 0;
    const latestDate = records[0]?.date || '';

    for (let row = 0; row < records.length; row++) {
        const item = records[row];
        const changeLong = Number(item.change_long) || 0;
        const changeShort = Number(item.change_short) || 0;

        let totalLong = changeLong >= 0 ? changeLong : 0;
        let totalShort = changeLong < 0 ? changeLong : 0;

        if (changeShort >= 0) {
            totalShort -= changeShort;
        } else {
            totalLong += Math.abs(changeShort);
        }

        const diff = totalLong + totalShort;

        if (row === 0) {
            lastChange = diff;
        }

        if (diff >= 0) {
            listRankLong.push([diff, row, item.date]);
        } else {
            listRankShort.push([diff, row, item.date]);
        }
    }

    // Sort descending for long, ascending for short
    listRankLong.sort((a, b) => b[0] - a[0]);
    listRankShort.sort((a, b) => a[0] - b[0]);

    if (lastChange >= 0) {
        for (let idx = 0; idx < listRankLong.length; idx++) {
            if (listRankLong[idx][1] === 0) {
                return { rank: idx + 1, value: lastChange, date: latestDate };
            }
        }
    } else {
        for (let idx = 0; idx < listRankShort.length; idx++) {
            if (listRankShort[idx][1] === 0) {
                return { rank: idx + 1, value: lastChange, date: latestDate };
            }
        }
    }

    return null;
}
