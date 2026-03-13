import mongoose, { Schema, Document } from 'mongoose';

/**
 * SENIOR ARCHITECT PRINCIPLE:
 * All API data must be preserved. We use Schema.Types.Mixed for wagon and train
 * objects to allow any field from the API to be stored without schema violations.
 * This is the correct approach: the database is the source of truth.
 *
 * Interfaces are kept for documentation/TypeScript hints, but the schema
 * uses Mixed + strict:false to store 100% of the incoming API data.
 */

// =====================================================================
// TYPE HINTS — for documentation only (actual storage is flexible)
// =====================================================================

export interface IWagon {
    // Core identity
    wagonNum:            string;
    index:               number;
    trainIndex:          string;

    // Cargo
    etsngCode:           string;
    etsngName?:          string | null;
    gngCode?:            string;
    gngName?:            string | null;
    weight:              number;   // Netto yuk og'irligi
    tara?:               number;   // Vagon tarasi
    brutto?:             number;
    gp?:                 number;   // Gabarit profil
    os?:                 number;   // O'q soni

    // Route
    sendStationCode?:    string;
    sendStrana?:         string;
    receiveStationCode?: string;
    receiveStrana?:      string;
    loadStationCode?:    string;
    exportStationCode?:  string;

    // Vehicle details
    wagonStranaCode?:    string;
    length?:             string;
    rodWagon?:           string | null;

    // Service/management
    codeOwner?:          string;
    codeMarshrut?:       string;
    codeCover?:          string;
    codeOversize?:       string;
    codePodshipn?:       string;
    plombCount?:         number;
    accessoryName?:      string;
    codeMiddleContCount?: string;
    codeBigContCount?:   string;

    // Parties
    customerName?:       string | null;
    receiverName?:       string | null;

    // Other
    du1Id?:              number;
    comment?:            string;
    [key: string]:       any;       // Any future API field
}

export interface ITrain {
    trainIndex:          string;
    numPoezd:            string;
    numSostav:           string;
    beginStationCode:    string;
    endStationCode:      string;
    brutto?:             number;
    maxLength?:          number;
    du1Id?:              number;
    wagonCount:          number;
    totalWeight:         number;
    wagons:              IWagon[];
    [key: string]:       any;       // Any future API field
}

export interface IDailyReport extends Document {
    date:        string;
    trains:      ITrain[];
    lastUpdated: number;
}

// =====================================================================
// MONGOOSE SCHEMAS — Using Mixed type + strict:false for 100% API preservation
// =====================================================================

/**
 * Wagon schema uses Mixed type for all fields.
 * strict:false means Mongoose will not strip unrecognized fields.
 */
const wagonSchema = new Schema({
    wagonNum:            { type: String },
    index:               { type: Number },
    trainIndex:          { type: String },
    etsngCode:           { type: String },
    etsngName:           { type: Schema.Types.Mixed },
    gngCode:             { type: String },
    gngName:             { type: Schema.Types.Mixed },
    weight:              { type: Number },
    tara:                { type: Number },
    gp:                  { type: Number },
    os:                  { type: Number },
    length:              { type: String },
    rodWagon:            { type: Schema.Types.Mixed },
    wagonStranaCode:     { type: String },
    sendStationCode:     { type: String },
    receiveStationCode:  { type: String },
    loadStationCode:     { type: String },
    sendStrana:          { type: String },
    receiveStrana:       { type: String },
    exportStationCode:   { type: String },
    codeOwner:           { type: String },
    codeMarshrut:        { type: String },
    codeCover:           { type: String },
    codeOversize:        { type: String },
    codePodshipn:        { type: String },
    plombCount:          { type: Number },
    accessoryName:       { type: String },
    codeMiddleContCount: { type: String },
    codeBigContCount:    { type: String },
    customerName:        { type: Schema.Types.Mixed },
    receiverName:        { type: Schema.Types.Mixed },
    du1Id:               { type: Number },
    comment:             { type: String },
}, { _id: false, strict: false }); // strict:false = accept any additional API field

/**
 * Train schema with all known API fields + strict:false for future fields.
 */
const trainSchema = new Schema({
    trainIndex:       { type: String, required: true },
    numPoezd:         { type: String },
    numSostav:        { type: String },
    beginStationCode: { type: String },
    endStationCode:   { type: String },
    brutto:           { type: Number },
    maxLength:        { type: Number },
    du1Id:            { type: Number },
    wagonCount:       { type: Number, default: 0 },
    totalWeight:      { type: Number, default: 0 },
    wagons:           [wagonSchema],
}, { _id: false, strict: false });

/**
 * Daily report: one document per date.
 */
const dailyReportSchema = new Schema<IDailyReport>({
    date:        { type: String, required: true, unique: true, index: true },
    trains:      [trainSchema],
    lastUpdated: { type: Number, default: Date.now },
}, {
    timestamps: true,
    strict: false,    // The root document can also store any extra top-level field
});

const DailyReport = mongoose.model<IDailyReport>('DailyReport', dailyReportSchema);
export default DailyReport;
