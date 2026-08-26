# Third-party data notices

## Japanese school curriculum (教育漢字 / 学年別漢字配当表)

School-grade assignments for elementary kanji are derived from the Japanese Ministry of Education (MEXT) 学年別漢字配当表 as published in the 小学校学習指導要領 (平成29年告示 / 2020施行), via the English Wikipedia article [Kyōiku kanji](https://en.wikipedia.org/wiki/Ky%C5%8Diku_kanji) grade tables used at build time.

## 常用漢字 (Jōyō)

Jōyō membership is taken from KANJIDIC-style grade fields (grades 1–6 and 8) in the community dataset [davidluzgouveia/kanji-data](https://github.com/davidluzgouveia/kanji-data), which incorporates EDRDG KANJIDIC data. See the [EDRDG licence](https://www.edrdg.org/edrdg/licence.html).

## JLPT levels

JLPT never publishes an official kanji list. Levels in this project come from:

- [OpenJLPT](https://github.com/evanclan/OpenJLPT) (CC BY / attributed sources), based on Jonathan Waller’s community JLPT lists
- Fallback JLPT fields from kanji-data / KANJIDIC where OpenJLPT has no entry

Treat JLPT tags as unofficial study aids, not exam guarantees.

## Runtime APIs

- [WaniKani API](https://docs.api.wanikani.com/) — official
- BunPro frontend API — unofficial, reverse-engineered with BunPro team permission ([community docs](https://github.com/cbullard-dev/bunpro-community-api))
- [kanjiapi.dev](https://kanjiapi.dev/) — KANJIDIC-derived JSON (nanori / name readings); EDRDG licence
- [Jisho](https://jisho.org/) — meanings, components, and example words (scraped / unofficial API)
