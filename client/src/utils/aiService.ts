export const cleanDataWithAI = async (rawText: string): Promise<string> => {
  try {
    // PROTECT VALID CYRILLIC
    // If the string already contains valid Cyrillic characters, it is NOT mojibake.
    // Converting it would destroy the UTF-8 bytes.
    if (/[а-яА-ЯёЁ]/.test(rawText)) {
      return rawText;
    }

    // "ÏPMÄ" and other garbled texts happen when bytes are read as Latin-1/ISO-8859-1 (or Windows-1252)
    // instead of the original CP866 (or CP1251). We first restore the bytes:
    const bytes = new Uint8Array(rawText.length);
    for (let i = 0; i < rawText.length; i++) {
      bytes[i] = rawText.charCodeAt(i) & 0xFF;
    }

    // Brauzerning standart TextDecoder API si orqali CP866 (ibm866) ga o'girish
    let decoded = new TextDecoder('ibm866').decode(bytes);

    // Edge case: Sometimes the source was actually CP1251 (e.g. ÏPMÄ -> ПPMД)
    // Agar CP866 da ramkaga o'xshash noto'g'ri belgilar (╧╨╠─) chiqsa, cp1251 ga o'tkazish
    if (decoded.includes('╧') || decoded.includes('╨') || decoded.includes('╠')) {
      decoded = new TextDecoder('windows-1251').decode(bytes);
    }

    return decoded;
  } catch (error) {
    console.error("Local Decode Error:", error);
    return rawText; // fallback to original if error
  }
};
