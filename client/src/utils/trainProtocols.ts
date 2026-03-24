
// Ushbu fayl taqdim etilgan hujjat asosida poezd indekslari protokollarini saqlaydi.
// Format: "JO'NATUVCHI_KOD-QABUL_QILUVCHI_KOD" (o'rtadagi raqamni hisobga olmaganda)

export interface ProtocolRule {
  stationName: string;
  qabulRules: Set<string>; // Kabul (Kirish)
  topshirishRules: Set<string>; // Topshirish (Chiqish)
}

// Yordamchi funksiya: Indeks oralig'ini yaratish (agar kerak bo'lsa) yoki ro'yxatni shakllantirish
const createSet = (codes: string[]) => new Set(codes);

export const TRAIN_PROTOCOL_RULES: Record<string, ProtocolRule> = {
  "САРЫАГАЧ": {
    stationName: "САРЫАГАЧ",
    qabulRules: createSet([
      "6980-7200", "6980-7258", "6980-7478", "6980-7364", "6980-7400",
      "6900-7200", "6600-7200", "7076-7200", "7076-7224", "7076-7235",
      "7076-7227", "7076-7425", "9800-7200", "9859-7200", "9859-7227",
      "9859-7235", "9859-7387", "7076-7364", "6978-7364", "6997-7200",
      "6997-7400", "6997-7364", "6915-7230", "6915-7200", "6915-7364",
      "6730-7200", "6911-7364", "6628-7369", "6946-7248", "6736-7269",
      "6997-7258", "6997-7280", "6979-7258", "7076-7269", "7076-7387",
      "6978-7258", "6926-7478", "6925-7252", "6915-7269", "6997-7331",
      "6900-7252", "6946-7200", "6900-7225", "6961-7200", "6961-7225",
      "6979-7200", "6925-7358", "6736-7478", "8200-7200", "6911-7422",
      "7973-7258", "6997-7478", "8200-7230", "6730-7478", "7000-7400",
      "6900-7400", "6900-7478", "8200-7258", "8200-7280", "8200-7331",
      "8100-7200", "7000-7200", "8200-7453", "6928-7478"
    ]),
    topshirishRules: createSet([
      "7200-6980", "7200-7046", "7200-7076", "7200-6900", "7200-6600",
      "7200-9859", "7200-7077"
    ])
  },
  "СЫРДАРЬЯ": {
    stationName: "СЫРДАРЬЯ",
    qabulRules: createSet(["6970-7247"]),
    topshirishRules: createSet(["7247-6970"])
  },
  "КАРАКАЛПАКСТАН": {
    stationName: "КАРАКАЛПАКСТАН",
    qabulRules: createSet(["6628-7372", "6628-7369", "6611-7372"]),
    topshirishRules: createSet([
      "7372-6628", "7372-6611", "7300-6611", "7399-6611", "7398-6611", "7390-6611"
    ])
  },
  "БЕКАБАД": {
    stationName: "БЕКАБАД",
    qabulRules: createSet(["7478-7261", "7478-7258", "7478-6980"]),
    topshirishRules: createSet(["7261-7478", "6980-7478", "7258-7478", "7300-7478"])
  },
  "ИСТИКЛОЛ": {
    stationName: "ИСТИКЛОЛ",
    qabulRules: createSet(["7478-7400", "7476-7400"]),
    topshirishRules: createSet(["7400-7478", "7400-7476"])
  },
  "КУДУКЛИ": {
    stationName: "КУДУКЛИ",
    qabulRules: createSet([
      "7458-7351"
    ]),
    topshirishRules: createSet([
      "7258-7452", "7258-7458", "7372-7458", "7372-7452", "7331-7458",
      "7331-7452", "7331-7456", "7331-7453", "7300-7458", "7300-7452",
      "7300-7456", "7300-7453", "7351-7452", "7356-7458"
    ])
  },
  "АМУЗАНГ": {
    stationName: "АМУЗАНГ",
    qabulRules: createSet(["7464-7351"]),
    topshirishRules: createSet(["7351-7464"])
  },
  "ТАХИАТАШ": {
    stationName: "ТАХИАТАШ",
    qabulRules: createSet(["7585-7390", "7585-7372", "7585-7377"]),
    topshirishRules: createSet(["7372-7585", "7390-7585", "7377-7585"])
  },
  "ХОДЖИДАВЛЕТ": { // Hujjatda "Хожа давлет"
    stationName: "ХОДЖИДАВЛЕТ",
    qabulRules: createSet(["7571-7300", "7502-7300", "7504-7300", "7571-7453",]),
    topshirishRules: createSet(["7300-7571", "7300-7569"])
  },
  "СУРХОНОБОД": { // Yangi stansiya
    stationName: "СУРХОНОБОД", // Hujjatda "Сурхонобод"
    qabulRules: createSet([
      "7568-7351", "7568-7453", "7568-7458", "7498-7351", "7498-7458", "7504-7453", "7497-7453",
    ]),
    topshirishRules: createSet(["7351-7498"])
  },
  "КАРАСУ": {
    stationName: "КИРГИЗИЯ", // Karasu odatda Kirgiziya posti
    qabulRules: createSet(["7180-7437"]),
    topshirishRules: createSet(["7437-7180", "7400-7180", "7400-7196"])
  },
  "ШОЛЛИСОЙ": {
    stationName: "ШОЛЛИСОЙ", // Hujjatda bor, lekin asosiy MGSP ro'yxatida bo'lmasligi mumkin
    qabulRules: createSet(["7192-7414"]),
    topshirishRules: createSet(["7414-7192"])
  },
  "КИЗИЛКИЯ": {
    stationName: "КИЗИЛКИЯ",
    qabulRules: createSet(["7191-7429", "7191-7432"]),
    topshirishRules: createSet(["7432-7191", "7429-7191"])
  },
  "ГАЛАБА": {
    stationName: "ГАЛАБА",
    qabulRules: createSet(["7364-7363"]),
    topshirishRules: createSet(["7363-7364"])
  }
};

/**
 * Poezd indeksini tekshirish funksiyasi
 * @param fullIndex - "(6980+05+7200)" formatidagi indeks
 * @returns { mgsp: string, type: 'qabul' | 'topshirish' } | null
 */
export const identifyTrainProtocol = (fullIndex: string): { mgsp: string, type: 'qabul' | 'topshirish' } | null => {
  // Indeksdan raqamlarni ajratib olish (Format: 6980-05-7200 yoki (6980+05+7200))
  // O'rtadagi raqamni hisobga olmay, 1chi va 3chi raqamlarni ajratamiz
  const match = fullIndex.match(/\(?\s*(\d{4})\s*[-+]\s*\d+\s*[-+]\s*(\d{4})\s*\)?/);

  if (!match) return null;

  const fromCode = match[1];
  const toCode = match[2];
  const key = `${fromCode}-${toCode}`;

  for (const [mgsp, rules] of Object.entries(TRAIN_PROTOCOL_RULES)) {
    if ((rules as any).qabulRules.has(key)) {
      return { mgsp: rules.stationName, type: 'qabul' };
    }
    if ((rules as any).topshirishRules.has(key)) {
      return { mgsp: rules.stationName, type: 'topshirish' };
    }
  }

  return null;
};
