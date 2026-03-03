import { parseOperationalDataGenerator } from './utils/parser';

const chunk = `
СППВ-69830 01.03 20-25
САРАГ  ПРМД 01.03  20-55
01 53428793 0201 064 70771 15123 7077 00 00 00 00 00
`;

const gen = parseOperationalDataGenerator(chunk, []);
for (const val of gen) {
    console.log(val);
}
