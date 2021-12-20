const config = require('./config.json');

const fs = require('fs');
const { parse, stringify } = require('himalaya');
const Iconv = require('iconv').Iconv;

const writer = (path, file) => {
    fs.writeFile(path, file, 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }
    });
}

const getContent = (page) => {
    // Заменяем все разрывы строк на пробел
    let _data = page.replace(/(?:\r\n|\r|\n)/g,' ');

    // Определяем контент как содержимое тэга <body>
    _data = _data.replace(/.*<body>([^]*)<\/body>[^]*/,"$1");

    // Определяем контент как содержимое тэга <div class="text">
    _data = _data.replace(/<div class="text">(.*)<\/div>/,"$1");

    return _data;
}

const content = [];
let link = config.index;

do {
    // считываем файл по ссылке
    const rawData = fs.readFileSync(`${config.input}${link}`);

    // находим в HTML-файле указание кодировки
    const charset = rawData.toString().match(/charset="*(.*?)["|;]/)[1];

    // определяем кодировку из текущей в UTF-8
    const iconv = new Iconv(charset, 'utf-8');
    let data = iconv.convert(rawData).toString();

    // определяем основной контент файла
    data = getContent(data);
    // и дописываем его в массив
    content.push(data);

    // Ищем ссылку на следующий файл
    // как ссылку внутри <nav> с классом "next"
    const a = data.match(/"nav".*?<a class="next"(.*?)\/a>/)[1];
    const match = a.match(/href="(.*?)"/);
    link = match && match.length && match[1].trim();

    // делаем ссылку невалидной если
    // ссылка начала ссылаться на исходный  или текущий файл
    if (
        link === config.index ||
        (link && link.length && link[0]==='#')
    ) {
        link = null;
    }

    console.log(link);
} while (link);

// склеиваем собранные ранее фрагменты файлов
let data = content.join('');

// удаляем HTML-комментарии
data = data.replace(/<!--[^.]*?-->/g,'');

// склеиваем несколько пробелов в один
data = data.replace(/\s{2,}/g,' ');

// Убираем первый пробел
data = data.replace(/^ /,'');

// Убираем пробелы между тегами
data = data.replace(/> </g, "><");

// Убираем абзацы, которые являеются: нумерацией страниц, панелями навигации
data = data.replace(/<p class="(?:rpage|lpage|lpage-top|rpage-top|nav)">.*?<\/p>/g, "");

// Убираем дополнительные ссылки
data = data.replace(/<div class="(?:noprint|center)">.*?<\/div>/g,"");

// Убираем разрывы строк
data = data.replace(/(?:<br>|<br\/>|<br \/>)/g,"");

// Убираем горизонтальную черту
data = data.replace(/(?:<hr>|<hr\/>|<hr.*?>)/g,"");

// Убираем последний пробел в абзаце
data = data.replace(/\s<\/p>/,"</p>"); // remove last space in paragraph

// Убираем ссылки и собираем их в отдельный массив
let rems = [];
data = data.replace(/<div class="rem">.*?<\/div>/g, match => {
    rems.push(match);
    return ("");
});

// Склеиваем разорванные параграфы
data = data.replace(/<p class="text">(.*?)<\/p><p>/g,"<p class=\"text\">$1");

// Склеиваем разорванные цитаты
data = data.replace(/<p class="cit">(.*?)<\/p><p class="cit2">/g,"<p class=\"cit\">$1");

// Переводим HTML текст в объектную модель
let jsonData = parse(data);

// Фильтруем теги первого уровня, отбразывая списки содержания
jsonData = jsonData.filter((item) => (!(item.tagName === "ul" && item.attributes.find(a => (a.key === "class" && a.value === "content")))));

// Переводим объектную модель в текст
data = stringify(jsonData);

// Добавляем в текст HTML-заголовок и собранные комментарии
data = ["<!doctype html><html lang=\"ru\"><head><meta charset=\"UTF-8\"></head>",data,rems,"</body></html>"].join("");
const output = JSON.stringify(jsonData);

// Сохраняем полученный файл
writer("./output/output.html", data);

console.log('Done.');
