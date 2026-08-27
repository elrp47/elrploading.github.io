/* EliteRP · экран загрузки
   ---------------------------------------------------------------------------
   Garry's Mod вызывает на этой странице пять функций. Все они обязаны быть
   глобальными и обязаны существовать до того, как игра до них дотянется, —
   поэтому объявляем их сразу, а не внутри обработчика загрузки документа.

     GameDetails(name, url, map, maxplayers, steamid, gamemode)
     SetFilesTotal(total)     — сколько файлов предстоит скачать
     SetFilesNeeded(needed)   — сколько ещё осталось
     DownloadingFile(name)    — какой файл идёт сейчас
     SetStatusChanged(status) — текстовый статус движка

   Код намеренно написан без современного синтаксиса (никаких let/const,
   стрелок, ?. и ??): встроенный браузер Garry's Mod на старых сборках всё ещё
   Awesomium, и одна незнакомая конструкция гасит страницу целиком. */

(function () {
    "use strict";

    var CFG = window.ELITERP_CONFIG || {};

    // ── Мелкие помощники ────────────────────────────────────────────────────

    function $(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        var el = $(id);
        if (el) { el.textContent = value; }
    }

    function clean(value, fallback) {
        if (value === null || value === undefined) { return fallback; }

        value = String(value).replace(/\s+/g, " ");
        value = value.replace(/^\s+|\s+$/g, "");

        return value === "" ? fallback : value;
    }

    // ── Состояние загрузки ──────────────────────────────────────────────────

    var state = {
        total: 0,
        needed: 0,
        done: false,

        // Отозвалась ли игра хоть чем-нибудь. Пока false — экран открыт в
        // обычном браузере, и только тогда допустим демонстрационный прогон.
        live: false
    };

    /* Игра позвала любую из своих функций либо в адресе оказались её
       параметры: с этого момента на экране только настоящие данные. */
    function goLive() {
        state.live = true;
    }

    function render() {
        var percent = 0;

        // Пока движок не сообщил, сколько файлов предстоит скачать, процента
        // не существует: полоса идёт бегунком, а вместо числа стоит прочерк.
        // Рисовать в этот момент «0 %» или свою придуманную шкалу — врать
        // игроку о том, чего страница не знает.
        var known = state.total > 0 || state.done;

        if (state.total > 0) {
            percent = (state.total - state.needed) / state.total * 100;
        } else if (state.done) {
            percent = 100;
        }

        if (percent < 0) { percent = 0; }
        if (percent > 100) { percent = 100; }

        var bar = $("bar");
        var fill = $("bar-fill");
        var sweep = $("bar-sweep");

        if (bar) {
            bar.className = known ? "bar" : "bar wait";
            bar.setAttribute("aria-valuenow", Math.round(percent));
        }

        if (fill) { fill.style.width = (known ? percent : 0) + "%"; }

        // Блик живёт только внутри заполненной части и только пока идёт
        // скачивание: на готовой полосе он выглядел бы как незавершённость.
        if (sweep) {
            sweep.style.width = (state.done || !known ? 0 : percent) + "%";
        }

        setText("progress-percent", known ? Math.round(percent) + " %" : "—");

        if (state.total > 0) {
            var loaded = state.total - state.needed;
            if (loaded < 0) { loaded = 0; }
            setText("progress-count", loaded + " / " + state.total + " файлов");
        } else {
            setText("progress-count", "");
        }
    }

    function markReady() {
        state.done = true;
        state.needed = 0;

        var dot = $("state-dot");
        if (dot) { dot.className = "dot ready"; }

        setText("state-label", "ГОТОВО");
        setText("progress-status", "ЗАГРУЗКА ЗАВЕРШЕНА");
        setText("progress-file", "Вход в Сити-17…");

        render();
    }

    // ── Адрес страницы ──────────────────────────────────────────────────────
    //
    // Garry's Mod дописывает к sv_loadingurl параметры самого подключения:
    //
    //   ?steamid=<steamid64>&gamemode=<режим>&mapname=<карта>&maxplayers=<n>
    //
    // Приходят они вместе с самим адресом, то есть раньше любого вызова
    // GameDetails, — поэтому сводка заполняется уже в первом кадре, а не через
    // секунду. Заодно это надёжный признак того, что страницу открыла игра, а
    // не браузер: демонстрационный прогон при таком заходе не запускается.

    function readQuery() {
        var out = {};
        var query = String(window.location.search || "");

        if (query.charAt(0) === "?") { query = query.substring(1); }
        if (query === "") { return out; }

        var parts = query.split("&");

        for (var i = 0; i < parts.length; i++) {
            var pair = parts[i].split("=");
            if (pair.length < 2) { continue; }

            var key = decodeURIComponent(pair[0]).toLowerCase();
            var value = decodeURIComponent(pair[1].replace(/\+/g, " "));

            out[key] = value;
        }

        return out;
    }

    function applyQuery() {
        var q = readQuery();
        var any = false;

        if (q.mapname)    { setText("info-map", q.mapname);           any = true; }
        if (q.gamemode)   { setText("info-gamemode", q.gamemode);     any = true; }
        if (q.maxplayers) { setText("info-maxplayers", q.maxplayers); any = true; }
        if (q.steamid)    { setText("info-steamid", q.steamid);       any = true; }

        if (any) {
            goLive();
            setText("state-label", "СИНХРОНИЗАЦИЯ");
        }
    }

    // ── Вызовы Garry's Mod ──────────────────────────────────────────────────

    window.GameDetails = function (name, url, map, maxplayers, steamid, gamemode) {
        goLive();

        setText("server-name", clean(name, CFG.fallbackName || "ELITERP"));
        setText("info-map", clean(map, "—"));
        setText("info-gamemode", clean(gamemode, "—"));
        setText("info-maxplayers", clean(maxplayers, "—"));
        setText("info-steamid", clean(steamid, "—"));

        setText("state-label", "СИНХРОНИЗАЦИЯ");
    };

    window.SetFilesTotal = function (total) {
        goLive();

        total = parseInt(total, 10);
        state.total = isNaN(total) ? 0 : total;
        render();
    };

    window.SetFilesNeeded = function (needed) {
        goLive();

        needed = parseInt(needed, 10);
        state.needed = isNaN(needed) ? 0 : needed;

        // Движок не сообщает об окончании отдельным вызовом — конец загрузки
        // это момент, когда при известном общем числе не осталось нужных.
        if (state.total > 0 && state.needed <= 0) {
            markReady();
            return;
        }

        render();
    };

    window.DownloadingFile = function (fileName) {
        goLive();

        if (state.done) { return; }

        setText("progress-status", "ЗАГРУЗКА РЕСУРСОВ");

        // Путь показываем целиком, но обрезается он слева (direction: rtl в
        // стилях), чтобы имя файла оставалось видно.
        setText("progress-file", clean(fileName, "—"));
    };

    /* Движок присылает статус по-английски и на разных сборках по-разному.
       Известные строки переводим, незнакомую показываем как есть — лучше
       английская правда, чем русская выдумка. Сопоставление идёт по вхождению
       подстроки в нижнем регистре. */
    var STATUS_RU = [
        ["workshop",            "ЗАГРУЗКА ДОПОЛНЕНИЙ WORKSHOP"],
        ["downloading",         "ЗАГРУЗКА РЕСУРСОВ"],
        ["retrieving",          "ЗАПРОС ДАННЫХ СЕРВЕРА"],
        ["receiving",           "ПРИЁМ ДАННЫХ СЕРВЕРА"],
        ["sending client",      "ОТПРАВКА КЛИЕНТСКИХ ДАННЫХ"],
        ["client info",         "ОТПРАВКА КЛИЕНТСКИХ ДАННЫХ"],
        ["connecting",          "УСТАНОВКА СВЯЗИ"],
        ["signon",              "АВТОРИЗАЦИЯ"],
        ["starting lua",        "ЗАПУСК ИГРОВОГО РЕЖИМА"],
        ["lua",                 "ЗАПУСК ИГРОВОГО РЕЖИМА"],
        ["map",                 "ЗАГРУЗКА КАРТЫ"],
        ["world",               "ПОСТРОЕНИЕ МИРА"],
        ["spawn",               "ВЫХОД В СЕКТОР"]
    ];

    function translateStatus(text) {
        var low = text.toLowerCase();

        for (var i = 0; i < STATUS_RU.length; i++) {
            if (low.indexOf(STATUS_RU[i][0]) !== -1) { return STATUS_RU[i][1]; }
        }

        return text.toUpperCase();
    }

    window.SetStatusChanged = function (status) {
        goLive();

        if (state.done) { return; }

        var text = clean(status, "");
        if (text === "") { return; }

        setText("progress-status", translateStatus(text));
    };

    // ── Фон: слайдшоу из папки fones ────────────────────────────────────────
    //
    // Каталог браузеру не виден, списка файлов взять неоткуда — поэтому имена
    // просто перебираются: 1.jpg, 2.jpg, 3.jpg… Каждое имя проверяется через
    // new Image(): загрузилось — снимок есть, ошибка — номер пропущен. Поиск
    // прекращается после backgroundGap пропусков подряд, чтобы не долбить
    // сервер шестьюдесятью запросами впустую.

    var EXTS = [".jpg", ".jpeg", ".png", ".webp", ".JPG", ".PNG"];

    function probe(url, ok, fail) {
        var img = new Image();

        img.onload = function () { ok(url); };
        img.onerror = function () { fail(); };

        img.src = url;
    }

    /* Пробует одно имя со всеми расширениями по очереди. */
    function probeNumber(folder, number, done) {
        var i = 0;

        (function next() {
            if (i >= EXTS.length) { done(null); return; }

            var url = folder + number + EXTS[i];
            i = i + 1;

            probe(url, function (found) { done(found); }, next);
        })();
    }

    function collectBackgrounds(done) {
        var explicit = CFG.backgrounds || [];

        // Явный список важнее автоподбора: имена могут быть какими угодно.
        if (explicit.length > 0) { done(explicit.slice(0)); return; }

        var folder = CFG.backgroundFolder || "fones/";
        var max = CFG.backgroundMax || 60;
        var gap = CFG.backgroundGap || 3;

        var found = [];
        var misses = 0;
        var n = 1;

        (function step() {
            if (n > max || misses >= gap) { done(found); return; }

            var current = n;
            n = n + 1;

            probeNumber(folder, current, function (url) {
                if (url) {
                    found.push(url);
                    misses = 0;

                    // Первый же найденный кадр показываем сразу, не дожидаясь
                    // конца перебора: экран не должен стоять чёрным.
                    if (found.length === 1) { showShot(url); }
                } else {
                    misses = misses + 1;
                }

                step();
            });
        })();
    }

    var shots = [];       // адреса найденных снимков
    var shotIndex = 0;
    var layers = [];      // два слоя, между которыми идёт перекрёстная смена
    var layerOn = 0;

    function showShot(url) {
        var box = $("bg-shots");
        if (!box) { return; }

        if (layers.length === 0) {
            for (var k = 0; k < 2; k++) {
                var div = document.createElement("div");
                div.className = "shot";
                box.appendChild(div);
                layers.push(div);
            }
        }

        // Пишем в тот слой, который сейчас невидим, и меняем их местами.
        var next = layers[1 - layerOn];
        var prev = layers[layerOn];

        next.style.backgroundImage = "url('" + url + "')";
        next.className = "shot on";
        prev.className = "shot";

        layerOn = 1 - layerOn;
    }

    function startBackgrounds() {
        collectBackgrounds(function (list) {
            shots = list;

            if (shots.length === 0) { return; }

            // Первый кадр уже на экране — его поставил collectBackgrounds.
            if (!layers.length) { showShot(shots[0]); }

            if (shots.length < 2) { return; }

            var seconds = CFG.backgroundInterval || 12;
            setInterval(function () {
                shotIndex = (shotIndex + 1) % shots.length;
                showShot(shots[shotIndex]);
            }, seconds * 1000);
        });
    }

    // ── Советы ──────────────────────────────────────────────────────────────

    function startTips() {
        var tips = CFG.tips || [];
        if (tips.length === 0) { return; }

        var perPage = CFG.tipsPerPage || 3;
        if (perPage < 1) { perPage = 1; }

        var pages = Math.ceil(tips.length / perPage);
        var list = $("tip-list");
        var dots = $("tip-dots");
        var page = 0;

        if (dots) {
            var markup = "";
            for (var k = 0; k < pages; k++) { markup += "<i></i>"; }
            dots.innerHTML = markup;
        }

        function esc(text) {
            return String(text === undefined || text === null ? "" : text)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }

        function show(index) {
            if (!list) { return; }

            var from = index * perPage;
            var html = "";

            for (var k = from; k < from + perPage && k < tips.length; k++) {
                var tip = tips[k];

                html += '<div class="tip">' +
                            '<div class="tip-key">' + esc(tip.key) + '</div>' +
                            '<div class="tip-body">' +
                                '<h3>' + esc(tip.title) + '</h3>' +
                                '<p>' + esc(tip.text) + '</p>' +
                            '</div>' +
                        '</div>';
            }

            list.innerHTML = html;

            // Перезапуск анимации появления: без сброса класса браузер её не
            // проигрывает повторно на том же узле.
            list.style.animation = "none";
            void list.offsetWidth;
            list.style.animation = "";

            if (dots) {
                var items = dots.getElementsByTagName("i");
                for (var j = 0; j < items.length; j++) {
                    items[j].className = (j === index) ? "on" : "";
                }
            }
        }

        show(0);

        if (pages < 2) { return; }

        var seconds = CFG.tipInterval || 12;
        setInterval(function () {
            page = (page + 1) % pages;
            show(page);
        }, seconds * 1000);
    }

    // ── Ссылки ──────────────────────────────────────────────────────────────

    function buildLinks() {
        var box = $("links");
        var links = CFG.links || [];

        if (!box) { return; }
        if (links.length === 0) {
            box.style.display = "none";
            return;
        }

        for (var i = 0; i < links.length; i++) {
            var a = document.createElement("a");
            a.textContent = links[i].label || "";
            a.href = links[i].url || "#";
            a.target = "_blank";
            a.rel = "noopener";
            box.appendChild(a);
        }
    }

    // ── Запуск ──────────────────────────────────────────────────────────────

    function init() {
        setText("server-name", CFG.fallbackName || "ELITERP");
        setText("server-tag", CFG.tagline || "");

        applyQuery();
        buildLinks();
        startTips();
        startBackgrounds();
        render();

        // Страницу открыли в обычном браузере: Garry's Mod не позовёт ни одну
        // из функций выше, и без этого экран остался бы мёртвым. Ждём три
        // секунды и, если игра не отозвалась ничем, показываем демонстрацию.
        //
        // Порог именно такой и проверяется именно state.live: на живом
        // подключении между открытием страницы и первым вызовом движка бывает
        // заметная пауза (особенно на слабом канале), а раньше демонстрация
        // успевала врубиться поверх настоящей загрузки и рисовала игроку
        // выдуманные файлы.
        setTimeout(function () {
            if (state.live) { return; }

            demo();
        }, 3000);
    }

    function demo() {
        setText("server-name", CFG.fallbackName || "ELITERP");
        setText("info-map", "rp_city17");
        setText("info-gamemode", "darkrp");
        setText("info-maxplayers", "64");
        setText("info-steamid", "STEAM_0:0:0000000");

        // Реальные пути из аддона: в демо-прогоне видно то же, что игрок
        // увидит на живой загрузке.
        var files = [
            "materials/eliterp/achievements/badcop.png",
            "models/combine/elite_helmet.mdl",
            "sound/commander/badcop/badcop_command1_vocode.wav",
            "materials/models/helmets/combine/soldier_exp.vtf",
            "models/combine_vests/elitevest.mdl",
            "materials/eliterp/achievements/hardened_cp.png",
            "sound/cloth/cloth_recall.wav",
            "models/bloocobalt/combine/combine_04.mdl"
        ];

        window.SetFilesTotal(files.length);

        var left = files.length;

        (function step() {
            if (left <= 0) { return; }

            window.DownloadingFile(files[files.length - left]);
            left = left - 1;
            window.SetFilesNeeded(left);

            if (left > 0) { setTimeout(step, 900); }
        })();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
