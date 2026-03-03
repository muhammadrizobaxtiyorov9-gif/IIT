const prmdRegex = /(?:П[РP]M[ДDОO0ТT])/i;
const cyrillicM = 'М';
const latinM = 'M';
console.log("Cyrillic M match?", prmdRegex.test("ПР" + cyrillicM + "Д"));
console.log("Latin M match?", prmdRegex.test("ПР" + latinM + "Д"));
