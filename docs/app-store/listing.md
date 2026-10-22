# App Store Connect — тексты для «Говори!»

Язык страницы: русский. Проверено по лимитам Apple.

## Название (≤ 30)
Говори! — тренажёр речи

## Подзаголовок (≤ 30)
Минута речи и честный разбор

## Рекламный текст (≤ 170)
Случайная тема, одна минута, и через пару секунд вы знаете, что получилось, а где проскочили «ну» и «как бы». Пять минут в день — и говорить становится проще.

## Описание
Помните это чувство, когда просят «пару слов» — а в голове пусто? Его можно натренировать, как мышцу.

Как это устроено:
Нажимаете плюс — приложение подкидывает случайную тему. Десять секунд собраться с мыслями, и шестьдесят секунд говорить. Без сценария, без шпаргалок, как в жизни.

Потом приходит разбор:
• оценка от 1 до 10 и пять критериев: структура, попадание в тему, словарь, плавность и темп;
• что у вас получилось — конкретно, с цитатами из вашей речи;
• что стоит подтянуть и как именно;
• сколько раз прозвучали «ну», «как бы», «типа» и прочие паразиты — они подсвечены прямо в тексте;
• темп речи в словах в минуту.

Все выступления сохраняются. Можно переслушать себя через неделю и услышать разницу — это, пожалуй, самое приятное.

Темы на любой вкус: жизнь, философия, технологии, бизнес и юмор. Сегодня рассуждаете, заменит ли ИИ учителей, завтра — продаёте обычную картошку как люксовый товар.

Кому пригодится:
• перед собеседованием или защитой проекта;
• тем, кто выступает на встречах и созвонах;
• студентам перед экзаменами;
• всем, кто хочет меньше мямлить и увереннее говорить.

Ваши записи — только ваши. Никакой рекламы и отслеживания, удалить запись или весь аккаунт можно в один тап.

## Ключевые слова (≤ 100)
риторика,ораторское,выступление,импровизация,публичная речь,собеседование,паразиты,уверенность

## URL службы поддержки
https://govori-production.up.railway.app/support

## Маркетинговый URL
https://govori-production.up.railway.app/

## URL политики конфиденциальности
https://govori-production.up.railway.app/privacy

## Авторские права
© 2026 Maksims Racins

## Информация для проверки приложения

**Требуется вход:** да
**Имя пользователя:** appreview
**Пароль:** задан в Railway (`Review__Password`), не хранится в репозитории.

**Примечания (на английском, для проверяющих):**

> Govori is a public-speaking practice app. The user gets a random topic, speaks for up to 60 seconds, and receives AI feedback: a score, strengths, things to improve and tips, plus a transcript with filler words highlighted.
>
> Sign-in: the app supports Sign in with Apple. For review, use the demo account instead: on the first screen tick the consent checkbox, tap "Вход по логину" (Sign in with username) at the bottom, and enter the credentials above.
>
> How to test: tap the black "+" button in the tab bar, wait for the topic (or tap "Начать запись"), allow microphone access and speak for at least 15 seconds, then tap "Закончить". Feedback appears in about 10–20 seconds. Past recordings are in the "История" tab and can be played back.
>
> The UI is in Russian. Speech in any language is transcribed, but the feedback is tuned for Russian.
>
> Microphone: used only while recording a speech. Audio is sent to our server and processed by OpenAI (transcription) and Anthropic (evaluation) only to produce the feedback, as disclosed on the consent screen and in the privacy policy. No ads, no tracking.
>
> Account deletion: Profile tab → "Удалить аккаунт" removes the account and all recordings.

## Видео для предпросмотра
Apple принимает только запись экрана самого приложения.
1. На iPhone: Пункт управления → Запись экрана. Пройдите сценарий за 20–30 секунд: «+» → тема → запись → разбор → прокрутка советов.
2. Перенесите файл на ПК и выполните: `.\make-preview.ps1 -In ScreenRecording.mov -Duration 30`.
3. Загрузите `app-preview-886x1920.mp4` в раздел iPhone 6,9".

## Картинки
- Заголовок: `header-5244x2950.png` или `header-3840x1646.png`
- Результаты поиска: `search-5244x2950.png`, `search-3840x2560.png`, `search-1920x1280.png`
- Исходник: `promo.mjs` (sharp).

## Снимки экрана (iPhone с Dynamic Island, средний дисплей — 1206×2622)
1. Снимите на iPhone 5 экранов (кнопка питания + громкость вверх), по порядку:
   1) экран темы, 2) запись с таймером, 3) разбор с оценкой, 4) расшифровка со словами-паразитами, 5) История.
2. Сложите их в папку как `1.png … 5.png` (HEIC сначала сохраните как PNG/JPG).
3. Оформите: `node screenshots.mjs <папка со снимками> <папка для результата>` (нужен `sharp`: `npm i sharp`).
4. Загрузите `screenshot-N-1206x2622.png` в App Store Connect.
Подписи к снимкам меняются в массиве `CAPTIONS` в `screenshots.mjs`.
