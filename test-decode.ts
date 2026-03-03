import * as iconv from 'iconv-lite';

function test() {
    const garbage = "ÏÐÌÄ"; // ПРМД
    const cppb = "CÏÏB";   // CППB

    // Reconstruct bytes from latin1 string
    const buf = Buffer.from(garbage, 'latin1');
    const buf2 = Buffer.from(cppb, 'latin1');

    // Decode using cp1251
    console.log("CP1251 Decode:", iconv.decode(buf, 'cp1251'));
    console.log("CP1251 Decode:", iconv.decode(buf2, 'cp1251'));

    // Decode using cp866
    console.log("CP866 Decode:", iconv.decode(buf, 'cp866'));
    console.log("CP866 Decode:", iconv.decode(buf2, 'cp866'));
}

test();
