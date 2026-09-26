/**
 * Asset definitions and CFTC Contract Market Codes.
 */
export interface AssetConfig {
    name: string;
    code: string;
    reportId: string;
    category: 'forex' | 'crypto' | 'metals' | 'index' | 'other';
}

export const ALL_ASSETS: AssetConfig[] = [
    // Chicago Forex, Crypto, Indices
    { name: 'EUR', code: '099741', reportId: 'deacmesf', category: 'forex' },
    { name: 'JPY', code: '097741', reportId: 'deacmesf', category: 'forex' },
    { name: 'AUD', code: '232741', reportId: 'deacmesf', category: 'forex' },
    { name: 'NZD', code: '112741', reportId: 'deacmesf', category: 'forex' },
    { name: 'CAD', code: '090741', reportId: 'deacmesf', category: 'forex' },
    { name: 'GBP', code: '096742', reportId: 'deacmesf', category: 'forex' },
    { name: 'CHF', code: '092741', reportId: 'deacmesf', category: 'forex' },
    { name: 'MXN', code: '095741', reportId: 'deacmesf', category: 'forex' },
    { name: 'BRL', code: '102741', reportId: 'deacmesf', category: 'forex' },
    { name: 'ZAR', code: '122741', reportId: 'deacmesf', category: 'forex' },
    { name: 'BTC', code: '133741', reportId: 'deacmesf', category: 'crypto' },
    { name: 'ETH', code: '146021', reportId: 'deacmesf', category: 'crypto' },
    { name: 'NASDAQ-100', code: '209742', reportId: 'deacmesf', category: 'index' },
    { name: 'S&P 500', code: '13874A', reportId: 'deacmesf', category: 'index' },
    // DJ, USD, New York, Commodities
    { name: 'DOW JONES', code: '124603', reportId: 'deacbtsf', category: 'index' },
    { name: 'USD', code: '098662', reportId: 'deanybtsf', category: 'forex' },
    { name: 'OIL', code: '067651', reportId: 'deanymesf', category: 'other' },
    { name: 'GAS', code: '023651', reportId: 'deanymesf', category: 'other' },
    { name: 'SILVER', code: '084691', reportId: 'deacmxsf', category: 'metals' },
    { name: 'COPPER', code: '085692', reportId: 'deacmxsf', category: 'metals' },
    { name: 'GOLD', code: '088691', reportId: 'deacmxsf', category: 'metals' },
];

export const ASSET_MAP = new Map(ALL_ASSETS.map((a) => [a.name, a]));
