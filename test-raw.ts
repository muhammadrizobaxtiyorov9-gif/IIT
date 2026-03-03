import { groupDataByDate, parseOperationalDataGenerator } from './utils/parser';

const sampleText = `ВЦ УТИ   112  02.03  13-52 УПР   
ПЕРЕЧЕНЬ ОПЕРАЦИЙ С ПОЕЗДОМ (6980+741+7364)

СТАН   ОПЕР ДАТА  ВРЕМЯ НАПР  НОМЕР    КПП  ДАТА  ВРЕМЯ
АРЫСЬ  ПРЕД 01.03 15-20 САРАГ  2062  00968  01.03 15-15 
АРЫСЬ  ОТПР 01.03 15-20 САРАГ  2062  АРЫСЬ  01.03 15-15 
САРАГ  ПРЕД 01.03 20-25 САРАГ  2062  00968  01.03 20-26 
САРАГ  ПРМД 01.03 20-55 КЕЛЕС  2062  САРАГ  01.03 21-00 
НАЗАР  ПРИБ 02.03 02-31 САРАГ  2062  НАЗАР  02.03 06-14 
НАЗАР  БРОС 02.03 02-32 00000  2062  НАЗАР  02.03 06-14
ВЦ УТИ   42  02.03  13-52 УПР  0
2062(6980+741+7364)  Д  ОХР
     БРОС 72223 02.03 02-32 НАПР 00000 ПАРК-   ПУТЬ-  
3188/4401 УДЛ-58 ОСИ-192/192 ВАГ-48
ГОЛ-29841392 ХВ-54604863 ПР-6 ВЕРХ-0 БОК-0 Ж-0 М-0
ВЦ УТИ    60 02.03  13-52 УПР   
2062 (6980+741+7364) БРОС 72220 02.03 02-32 НАПР-00000
НППВ-02102 ИППВ-69830 01.03 20-25   СППВ-69830 01.03 20-25


(:902 7222 2062 6980 741 7364 1 02 03 02 32 058 04401 6 0000 0 0
 01 29841392 0271 066 73643  50102 7041 0 0 6 4 00/00 00000 000 ОХРАНА
 02 29315876 0271 067 73643  50102 7041 0 0 6 4 00/00 00000 000 ОХРАНА`;

const grouped = groupDataByDate(sampleText);
const firstDate = Object.keys(grouped)[0];
console.log("Date:", firstDate);

const chunk = grouped[firstDate];

const gen = parseOperationalDataGenerator(chunk, []);
for (const batch of gen) {
    if (Array.isArray(batch)) {
        batch.forEach(w => {
            console.log(`Wagon ${w.number} rawBlock length: ${w.rawBlock?.length}`);
            console.log("Raw Block Data:\n", w.rawBlock?.substring(0, 100));
        });
    }
}
