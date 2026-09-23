/**
 * QS Intelligence country benchmark database.
 *
 * Rates are indicative planning benchmarks in USD and should be replaced with
 * verified local market data before commercial decisions are made. The data is
 * deliberately kept in a separate file so it can be versioned or replaced by
 * an API without changing the dashboard calculation code.
 */
(function (global) {
    "use strict";

    const BASE_RATES_USD = Object.freeze({
        concrete: 165,
        steel: 1.35,
        masonry: 42,
        finishes: 58,
        mep: 115,
        earthworks: 24,
        formwork: 38,
        asphalt: 78
    });

    // Ten country factors are applied to the same USD base rate. This makes the
    // comparison transparent while still allowing country-specific calibration.
    const COUNTRIES = Object.freeze([
        { code: "AE", name: "United Arab Emirates", currency: "AED", factor: 1.32 },
        { code: "SA", name: "Saudi Arabia", currency: "SAR", factor: 1.08 },
        { code: "QA", name: "Qatar", currency: "QAR", factor: 1.18 },
        { code: "GB", name: "United Kingdom", currency: "GBP", factor: 1.27 },
        { code: "US", name: "United States", currency: "USD", factor: 1.00 },
        { code: "CA", name: "Canada", currency: "CAD", factor: 0.96 },
        { code: "AU", name: "Australia", currency: "AUD", factor: 1.16 },
        { code: "DE", name: "Germany", currency: "EUR", factor: 1.12 },
        { code: "IN", name: "India", currency: "INR", factor: 0.42 },
        { code: "ZA", name: "South Africa", currency: "ZAR", factor: 0.58 }
    ]);

    const CATEGORY_ALIASES = Object.freeze({
        concrete: ["concrete", "rc", "reinforced", "cement", "pcc"],
        steel: ["steel", "rebar", "reinforcement", "structural steel", "metal"],
        masonry: ["masonry", "block", "brick", "partition", "wall"],
        finishes: ["finish", "tiling", "tile", "paint", "plaster", "floor", "ceiling"],
        mep: ["mep", "mechanical", "electrical", "plumbing", "hvac", "fire fighting"],
        earthworks: ["earthwork", "excavat", "backfill", "fill", "soil", "grading"],
        formwork: ["formwork", "shuttering", "scaffold"],
        asphalt: ["asphalt", "road", "pavement", "bitumen"]
    });

    function normaliseCategory(value) {
        const text = String(value || "").toLowerCase();
        return Object.keys(CATEGORY_ALIASES).find((category) =>
            CATEGORY_ALIASES[category].some((alias) => text.includes(alias))
        ) || "concrete";
    }

    function getCountry(code) {
        return COUNTRIES.find((country) => country.code === code) || COUNTRIES[4];
    }

    function getRate(category, countryCode) {
        const country = getCountry(countryCode);
        const key = normaliseCategory(category);
        return BASE_RATES_USD[key] * country.factor;
    }

    function getRates(category, countryCodes = COUNTRIES.map((country) => country.code)) {
        return countryCodes.map((code) => {
            const country = getCountry(code);
            return {
                ...country,
                category: normaliseCategory(category),
                rateUSD: getRate(category, code)
            };
        });
    }

    function median(values) {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return 0;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    /**
     * Compare a BOQ rate against the selected countries' median benchmark.
     * A rate is considered logical when it is within the configured tolerance.
     */
    function compareRate(boqRate, category, options = {}) {
        const tolerance = Number.isFinite(options.tolerance) ? Math.abs(options.tolerance) : 0.15;
        const countryCodes = options.countryCodes || COUNTRIES.map((country) => country.code);
        const benchmarks = getRates(category, countryCodes);
        const benchmarkRate = median(benchmarks.map((item) => item.rateUSD));
        const rate = Number(boqRate) || 0;
        const variance = benchmarkRate ? (rate - benchmarkRate) / benchmarkRate : 0;
        let status = "Logical";
        if (variance > tolerance) status = "High";
        if (variance < -tolerance) status = "Low";

        return {
            category: normaliseCategory(category),
            boqRate: rate,
            benchmarkRate,
            variance,
            variancePercent: variance * 100,
            status,
            logical: Math.abs(variance) <= tolerance,
            countries: benchmarks,
            tolerance
        };
    }

    global.QSBenchmarkDatabase = Object.freeze({
        version: "2026.1",
        currency: "USD",
        countries: COUNTRIES,
        baseRatesUSD: BASE_RATES_USD,
        categoryAliases: CATEGORY_ALIASES,
        normaliseCategory,
        getCountry,
        getRate,
        getRates,
        compareRate
    });
})(window);
