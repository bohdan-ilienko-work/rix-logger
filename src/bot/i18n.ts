export type Lang = 'ru' | 'en' | 'uk';

const translations = {
    // ─── Keywords ───
    skipKeyword: { ru: 'пропустить', en: 'skip', uk: 'пропустити' },
    cancelKeyword: { ru: 'отмена', en: 'cancel', uk: 'скасувати' },
    timeNow: { ru: 'сейчас', en: 'now', uk: 'зараз' },
    yesWords: { ru: ['да', 'д', 'yes', 'y'], en: ['yes', 'y', 'да', 'д'], uk: ['так', 'т', 'yes', 'y', 'да'] },
    noWords: { ru: ['нет', 'н', 'no', 'n'], en: ['no', 'n', 'нет', 'н'], uk: ['ні', 'н', 'no', 'n', 'нет'] },

    // ─── Reply buttons ───
    replyWalk: { ru: '🦮 Прогулка', en: '🦮 Walk', uk: '🦮 Прогулянка' },
    replyFood: { ru: '🍽 Еда', en: '🍽 Food', uk: '🍽 Їжа' },
    replyWeight: { ru: '⚖️ Вес', en: '⚖️ Weight', uk: '⚖️ Вага' },
    replyNote: { ru: '📝 Заметка', en: '📝 Note', uk: '📝 Нотатка' },
    replyStats: { ru: '📊 Статистика', en: '📊 Stats', uk: '📊 Статистика' },
    replyPets: { ru: '🐾 Питомцы', en: '🐾 Pets', uk: '🐾 Улюбленці' },
    replyInvite: { ru: '👥 Пригласить', en: '👥 Invite', uk: '👥 Запросити' },
    replyMiniapp: { ru: '📱 Мини-приложение', en: '📱 Mini-app', uk: '📱 Міні-додаток' },

    // ─── General ───
    errorNoTelegramUser: {
        ru: 'Не удалось определить пользователя Telegram.',
        en: 'Could not identify Telegram user.',
        uk: 'Не вдалося визначити користувача Telegram.',
    },
    errorUnknownMessage: {
        ru: 'Я не понял сообщение. Используйте /start, чтобы открыть главное меню.',
        en: "I didn't understand. Use /start to open the main menu.",
        uk: 'Я не зрозумів повідомлення. Використайте /start, щоб відкрити головне меню.',
    },
    mainMenuPrompt: {
        ru: 'Главное меню — выберите действие:',
        en: 'Main menu — choose an action:',
        uk: 'Головне меню — оберіть дію:',
    },
    displayNameFallback: { ru: 'друг', en: 'friend', uk: 'друже' },

    // ─── Start / Welcome ───
    welcomeBack: {
        ru: '👋 С возвращением, {name}!\nАктивный питомец: {petName}',
        en: '👋 Welcome back, {name}!\nActive pet: {petName}',
        uk: '👋 З поверненням, {name}!\nАктивний улюбленець: {petName}',
    },
    accountReadyNoPet: {
        ru: '✅ Аккаунт готов!\n\nДоступ к питомцу пока не найден.\n• Если пришли по приглашению — откройте invite-ссылку\n• Или добавьте своего: /add_pet',
        en: '✅ Account ready!\n\nNo pet access found yet.\n• If you have an invite — open the invite link\n• Or add your own: /add_pet',
        uk: '✅ Акаунт готовий!\n\nДоступ до улюбленця поки не знайдено.\n• Якщо є запрошення — відкрийте invite-посилання\n• Або додайте свого: /add_pet',
    },
    addPetDecisionPrompt: {
        ru: 'Привет! Хотите добавить питомца сейчас? Ответьте "да" или "нет".\n\nЕсли ответите "нет", просто открою меню без онбординга.',
        en: 'Hello! Want to add a pet now? Reply "yes" or "no".\n\nIf "no", I\'ll open the menu without onboarding.',
        uk: 'Привіт! Хочете додати улюбленця зараз? Відповідайте "так" або "ні".\n\nЯкщо "ні", просто відкрию меню без онбордингу.',
    },

    // ─── Add pet / Onboarding ───
    addPetShareContactFirst: {
        ru: 'Чтобы добавить питомца, сначала поделитесь контактом.',
        en: 'To add a pet, please share your contact first.',
        uk: 'Щоб додати улюбленця, спочатку поділіться контактом.',
    },
    askPetName: {
        ru: 'Как зовут вашего питомца?',
        en: "What's your pet's name?",
        uk: 'Як звати вашого улюбленця?',
    },
    addPetFirst: {
        ru: 'Сначала добавьте питомца: /add_pet',
        en: 'Add a pet first: /add_pet',
        uk: 'Спочатку додайте улюбленця: /add_pet',
    },
    addPetYesResponse: {
        ru: 'Отлично. Для начала поделитесь контактом.',
        en: 'Great. First, share your contact.',
        uk: 'Чудово. Для початку поділіться контактом.',
    },
    addPetNoResponse: {
        ru: 'Ок, без добавления питомца. Меню доступно, а онбординг можно запустить позже через /add_pet.',
        en: "OK, no pet added. The menu is available; you can onboard later via /add_pet.",
        uk: 'Ок, без додавання. Меню доступне, онбординг можна запустити пізніше через /add_pet.',
    },
    addPetDecisionRepeat: {
        ru: 'Ответьте "да" или "нет".',
        en: 'Reply "yes" or "no".',
        uk: 'Відповідайте "так" або "ні".',
    },

    // ─── Invite / Join ───
    inviteLinkInvalid: {
        ru: 'Ссылка-приглашение недействительна или просрочена.',
        en: 'Invite link is invalid or expired.',
        uk: 'Посилання-запрошення недійсне або прострочене.',
    },
    inviteLinkExpired: {
        ru: 'Ссылка-приглашение просрочена.',
        en: 'Invite link has expired.',
        uk: 'Посилання-запрошення прострочене.',
    },
    invitePetNotFound: {
        ru: 'Питомец не найден. Возможно, приглашение устарело.',
        en: 'Pet not found. The invite may be outdated.',
        uk: 'Улюбленця не знайдено. Можливо, запрошення застаріло.',
    },
    alreadyHasAccessNoDowngrade: {
        ru: 'Вы уже имеете доступ к {petName} с ролью {role}. Понижение не произведено.',
        en: 'You already have access to {petName} with role {role}. No downgrade performed.',
        uk: 'Ви вже маєте доступ до {petName} з роллю {role}. Зниження не виконано.',
    },
    inviteJoinSuccess: {
        ru: 'Готово! Вам выдан доступ к питомцу {petName} (роль: {role}).',
        en: 'Done! Access granted to pet {petName} (role: {role}).',
        uk: 'Готово! Вам надано доступ до улюбленця {petName} (роль: {role}).',
    },
    inviteOnlyOwner: {
        ru: 'Только владелец может приглашать участников.',
        en: 'Only the owner can invite members.',
        uk: 'Тільки власник може запрошувати учасників.',
    },
    inviteLinkMessage: {
        ru: '🔗 Ссылка-приглашение для {petName} (роль: CAREGIVER):\n\n{link}\n\nОтправьте её человеку — он нажмёт Start и получит доступ.',
        en: '🔗 Invite link for {petName} (role: CAREGIVER):\n\n{link}\n\nSend it to someone — they press Start and get access.',
        uk: '🔗 Посилання-запрошення для {petName} (роль: CAREGIVER):\n\n{link}\n\nВідправте його людині — вона натисне Start та отримає доступ.',
    },

    // ─── Contact / Onboarding flow ───
    shareContactButton: {
        ru: 'Поделиться контактом',
        en: 'Share contact',
        uk: 'Поділитися контактом',
    },
    shareContactPrompt: {
        ru: 'Нажмите кнопку ниже, чтобы отправить контакт:',
        en: 'Press the button below to share your contact:',
        uk: 'Натисніть кнопку нижче, щоб надіслати контакт:',
    },
    contactPleaseShareOwn: {
        ru: 'Пожалуйста, отправьте свой контакт кнопкой «Поделиться контактом».',
        en: 'Please share your own contact using the "Share contact" button.',
        uk: 'Будь ласка, надішліть свій контакт кнопкою «Поділитися контактом».',
    },
    contactInviteExpiredFallback: {
        ru: 'Ссылка-приглашение недействительна или просрочена. Можно продолжить обычный onboarding.',
        en: 'Invite link is invalid or expired. You can continue with regular onboarding.',
        uk: 'Посилання-запрошення недійсне або прострочене. Можна продовжити звичайний онбординг.',
    },
    contactInvitePetNotFoundFallback: {
        ru: 'Питомец из приглашения не найден. Можно продолжить обычный onboarding.',
        en: 'Pet from invite not found. You can continue with regular onboarding.',
        uk: 'Улюбленця із запрошення не знайдено. Можна продовжити звичайний онбординг.',
    },
    contactInviteJoinSuccess: {
        ru: 'Готово! Вы подключены к питомцу {petName} (роль: {role}).',
        en: 'Done! You are connected to pet {petName} (role: {role}).',
        uk: 'Готово! Ви підключені до улюбленця {petName} (роль: {role}).',
    },
    contactSavedAskPetName: {
        ru: 'Контакт сохранен. Как зовут вашего питомца?',
        en: 'Contact saved. What is your pet\'s name?',
        uk: 'Контакт збережено. Як звати вашого улюбленця?',
    },
    restartOnboardingIntro: {
        ru: 'Начинаем onboarding заново. Поделитесь, пожалуйста, вашим контактом.',
        en: 'Starting onboarding over. Please share your contact.',
        uk: 'Починаємо онбординг заново. Поділіться, будь ласка, вашим контактом.',
    },

    // ─── Onboarding steps ───
    onboardingWaitContact: {
        ru: 'Сначала нажмите кнопку «Поделиться контактом», чтобы продолжить.',
        en: 'First, press "Share contact" to continue.',
        uk: 'Спочатку натисніть «Поділитися контактом», щоб продовжити.',
    },
    onboardingPetNameRequired: {
        ru: 'Имя питомца обязательно. Введите имя.',
        en: "Pet name is required. Enter a name.",
        uk: "Ім'я улюбленця обов'язкове. Введіть ім'я.",
    },
    onboardingAskAge: {
        ru: 'Сколько лет питомцу? Если не знаете, напишите «{skip}».',
        en: 'How old is the pet? Type "{skip}" to skip.',
        uk: 'Скільки років улюбленцю? Якщо не знаєте, напишіть «{skip}».',
    },
    onboardingAskBreed: {
        ru: 'Какая порода? Если не хотите указывать, напишите «{skip}».',
        en: 'What breed? Type "{skip}" to skip.',
        uk: 'Яка порода? Якщо не хочете вказувати, напишіть «{skip}».',
    },
    onboardingAskWeight: {
        ru: 'Укажите вес в кг (например, 12.5). Если не знаете, напишите «{skip}».',
        en: 'Enter weight in kg (e.g. 12.5). Type "{skip}" to skip.',
        uk: 'Вкажіть вагу в кг (наприклад, 12.5). Якщо не знаєте, напишіть «{skip}».',
    },
    onboardingWeightParseError: {
        ru: 'Не удалось распознать вес. Введите число (например, 12.5) или «{skip}».',
        en: 'Could not parse weight. Enter a number (e.g. 12.5) or "{skip}".',
        uk: 'Не вдалося розпізнати вагу. Введіть число (наприклад, 12.5) або «{skip}».',
    },
    onboardingAskNote: {
        ru: 'Добавьте заметку о питомце, если хотите. Для пропуска напишите «{skip}».',
        en: 'Add a note about the pet, or type "{skip}" to skip.',
        uk: 'Додайте нотатку про улюбленця, або напишіть «{skip}».',
    },
    onboardingUserNotFoundRestart: {
        ru: 'Не удалось найти пользователя. Начнем заново, отправьте контакт.',
        en: 'User not found. Let\'s restart — share your contact.',
        uk: 'Не вдалося знайти користувача. Починаймо заново, надішліть контакт.',
    },
    onboardingPetNameLostRestart: {
        ru: 'Не удалось сохранить имя питомца. Начнем onboarding заново.',
        en: "Pet name was lost. Let's restart onboarding.",
        uk: "Не вдалося зберегти ім'я улюбленця. Починаймо онбординг заново.",
    },
    onboardingStepError: {
        ru: 'Произошла ошибка шага onboarding. Используйте /restart_onboarding.',
        en: 'Onboarding step error. Use /restart_onboarding.',
        uk: 'Помилка кроку онбордингу. Використайте /restart_onboarding.',
    },

    // ─── Onboarding summary ───
    summaryTitle: { ru: 'Регистрация завершена.', en: 'Registration complete.', uk: 'Реєстрація завершена.' },
    summarySubtitle: { ru: 'Короткое резюме:', en: 'Summary:', uk: 'Коротке резюме:' },
    summaryName: { ru: 'Имя: {v}', en: 'Name: {v}', uk: "Ім'я: {v}" },
    summaryAge: { ru: 'Возраст: {v}', en: 'Age: {v}', uk: 'Вік: {v}' },
    summaryBreed: { ru: 'Порода: {v}', en: 'Breed: {v}', uk: 'Порода: {v}' },
    summaryWeight: { ru: 'Вес: {v} кг', en: 'Weight: {v} kg', uk: 'Вага: {v} кг' },
    summaryNote: { ru: 'Заметка: {v}', en: 'Note: {v}', uk: 'Нотатка: {v}' },
    notSpecified: { ru: 'не указано', en: 'not specified', uk: 'не вказано' },

    // ─── Pending events ───
    pendingEventStartFirst: {
        ru: 'Сначала выполните /start, чтобы зарегистрироваться.',
        en: 'Run /start first to register.',
        uk: 'Спочатку виконайте /start, щоб зареєструватися.',
    },
    pendingEventNoPets: {
        ru: 'У вас нет питомцев. Добавьте питомца через /add_pet или примите приглашение.',
        en: 'You have no pets. Add one via /add_pet or accept an invite.',
        uk: 'У вас немає улюбленців. Додайте через /add_pet або прийміть запрошення.',
    },
    pendingEventCancelled: {
        ru: 'Действие отменено.',
        en: 'Action cancelled.',
        uk: 'Дію скасовано.',
    },
    pendingWeightParseError: {
        ru: 'Некорректный вес. Введите число (например, 12.5) или «{cancel}».',
        en: 'Invalid weight. Enter a number (e.g. 12.5) or "{cancel}".',
        uk: 'Некоректна вага. Введіть число (наприклад, 12.5) або «{cancel}».',
    },
    pendingWeightSaved: {
        ru: 'Вес {v} кг сохранен.',
        en: 'Weight {v} kg saved.',
        uk: 'Вагу {v} кг збережено.',
    },
    pendingNoteEmpty: {
        ru: 'Заметка не может быть пустой. Введите текст или «{cancel}».',
        en: 'Note cannot be empty. Enter text or "{cancel}".',
        uk: 'Нотатка не може бути порожньою. Введіть текст або «{cancel}».',
    },
    pendingNoteSaved: { ru: 'Заметка сохранена.', en: 'Note saved.', uk: 'Нотатку збережено.' },

    // ─── Walk flow ───
    walkCancelled: { ru: 'Запись прогулки отменена.', en: 'Walk recording cancelled.', uk: 'Запис прогулянки скасовано.' },
    walkAskDuration: {
        ru: 'Сколько примерно гуляли (в минутах)?\nДля отмены: «{cancel}».',
        en: 'How long was the walk (minutes)?\nTo cancel: "{cancel}".',
        uk: 'Скільки приблизно гуляли (у хвилинах)?\nДля скасування: «{cancel}».',
    },
    walkDurationParseError: {
        ru: 'Не удалось распознать длительность. Введите число минут, например 35. Для отмены: «{cancel}».',
        en: 'Could not parse duration. Enter minutes, e.g. 35. To cancel: "{cancel}".',
        uk: 'Не вдалося розпізнати тривалість. Введіть кількість хвилин, наприклад 35. Для скасування: «{cancel}».',
    },
    walkAskEndTime: {
        ru: 'Когда вернулись с прогулки? Напишите время в формате ЧЧ:ММ или «{now}». Для отмены: «{cancel}».',
        en: 'When did you return? Type time as HH:MM or "{now}". To cancel: "{cancel}".',
        uk: 'Коли повернулися з прогулянки? Напишіть час у форматі ГГ:ХХ або «{now}». Для скасування: «{cancel}».',
    },
    walkEndTimeParseError: {
        ru: 'Укажите время окончания в формате ЧЧ:ММ или напишите «{now}». Для отмены: «{cancel}».',
        en: 'Enter end time as HH:MM or type "{now}". To cancel: "{cancel}".',
        uk: 'Вкажіть час закінчення у форматі ГГ:ХХ або напишіть «{now}». Для скасування: «{cancel}».',
    },
    walkAskPoop: {
        ru: 'Какал ли на прогулке? Ответьте «да» или «нет».',
        en: 'Did the pet poop? Reply "yes" or "no".',
        uk: 'Какав на прогулянці? Відповідайте «так» або «ні».',
    },
    walkAskPee: {
        ru: 'Писал ли на прогулке? Ответьте «да» или «нет».',
        en: 'Did the pet pee? Reply "yes" or "no".',
        uk: 'Писяв на прогулянці? Відповідайте «так» або «ні».',
    },
    walkYesNoParseError: {
        ru: 'Не понял ответ. Напишите «да» или «нет». Для отмены: «{cancel}».',
        en: 'Didn\'t understand. Type "yes" or "no". To cancel: "{cancel}".',
        uk: 'Не зрозумів відповідь. Напишіть «так» або «ні». Для скасування: «{cancel}».',
    },
    walkAskNote: {
        ru: 'Доп. заметка по прогулке (например, настроение, активность). Или «{skip}».',
        en: 'Additional walk note (mood, activity). Or "{skip}".',
        uk: 'Додаткова нотатка по прогулянці (настрій, активність). Або «{skip}».',
    },
    walkSaveError: {
        ru: 'Не удалось сохранить прогулку. Попробуйте еще раз.',
        en: 'Failed to save walk. Try again.',
        uk: 'Не вдалося зберегти прогулянку. Спробуйте ще раз.',
    },
    walkSaved: {
        ru: 'Прогулка сохранена.\nРезюме:\n{start} → {end} ({dur} мин)\nКакал: {pooped}\nПисал: {peed}',
        en: 'Walk saved.\nSummary:\n{start} → {end} ({dur} min)\nPooped: {pooped}\nPeed: {peed}',
        uk: 'Прогулянку збережено.\nРезюме:\n{start} → {end} ({dur} хв)\nКакав: {pooped}\nПисяв: {peed}',
    },
    walkStepError: {
        ru: 'Ошибка шага прогулки. Попробуйте начать снова.',
        en: 'Walk step error. Try starting again.',
        uk: 'Помилка кроку прогулянки. Спробуйте почати знову.',
    },
    yes: { ru: 'да', en: 'yes', uk: 'так' },
    no: { ru: 'нет', en: 'no', uk: 'ні' },

    // ─── Callback / inline ───
    cbWalkStartToast: { ru: 'Начинаем запись прогулки', en: 'Starting walk recording', uk: 'Починаємо запис прогулянки' },
    cbFoodQuickValue: { ru: 'Быстрая отметка', en: 'Quick mark', uk: 'Швидка відмітка' },
    cbFoodRecordedToast: { ru: 'Кормление записано', en: 'Feeding recorded', uk: 'Годування записано' },
    cbFoodRecordedMessage: { ru: 'Готово, кормление записано.', en: 'Done, feeding recorded.', uk: 'Готово, годування записано.' },
    cbWeightAsk: {
        ru: 'Введите текущий вес в кг (например, 12.5) или «{cancel}».',
        en: 'Enter current weight in kg (e.g. 12.5) or "{cancel}".',
        uk: 'Введіть поточну вагу в кг (наприклад, 12.5) або «{cancel}».',
    },
    cbNoteAsk: {
        ru: 'Введите текст заметки или «{cancel}».',
        en: 'Enter note text or "{cancel}".',
        uk: 'Введіть текст нотатки або «{cancel}».',
    },
    cbNoEventsToday: { ru: 'Нет событий за сегодня', en: 'No events today', uk: 'Немає подій за сьогодні' },
    cbLastEventDeletedToast: { ru: 'Последнее событие удалено', en: 'Last event deleted', uk: 'Останню подію видалено' },
    cbLastEventDeletedMessage: { ru: '🗑 Удалено: {type}', en: '🗑 Deleted: {type}', uk: '🗑 Видалено: {type}' },
    cbPetNotFound: { ru: 'Питомец не найден', en: 'Pet not found', uk: 'Улюбленця не знайдено' },
    cbOnlyOwner: { ru: 'Только владелец', en: 'Owner only', uk: 'Тільки власник' },
    cbUnknownAction: { ru: 'Неизвестное действие', en: 'Unknown action', uk: 'Невідома дія' },
    cbAvatarAskPhoto: {
        ru: 'Отправьте фото для аватара {petName} или «{cancel}».',
        en: 'Send a photo for {petName}\'s avatar or "{cancel}".',
        uk: 'Надішліть фото для аватара {petName} або «{cancel}».',
    },

    // ─── Stats ───
    statsTitle: { ru: 'Статистика за 24 ч:', en: 'Stats for 24h:', uk: 'Статистика за 24 год:' },
    statsWalks: { ru: 'Прогулки: {v}', en: 'Walks: {v}', uk: 'Прогулянки: {v}' },
    statsFeedings: { ru: 'Кормления: {v}', en: 'Feedings: {v}', uk: 'Годування: {v}' },
    statsWeightEntries: { ru: 'Записи веса: {v}', en: 'Weight entries: {v}', uk: 'Записи ваги: {v}' },
    statsNotes: { ru: 'Заметки: {v}', en: 'Notes: {v}', uk: 'Нотатки: {v}' },
    statsLatestWeight: { ru: 'Последний вес: {v} кг', en: 'Latest weight: {v} kg', uk: 'Остання вага: {v} кг' },
    statsNoWeightData: { ru: 'нет данных', en: 'no data', uk: 'немає даних' },

    // ─── Edit pet ───
    editPetStartFirst: { ru: 'Сначала /start', en: 'Run /start first', uk: 'Спочатку /start' },
    editPetNoPets: { ru: 'Нет питомцев. /add_pet', en: 'No pets. /add_pet', uk: 'Немає улюбленців. /add_pet' },
    editPetOnlyOwner: { ru: 'Только владелец может редактировать.', en: 'Only owner can edit.', uk: 'Тільки власник може редагувати.' },
    editPetPrompt: {
        ru: 'Редактирование {petName}. Что изменить?\n1️⃣ Имя\n2️⃣ Возраст\n3️⃣ Породу\n4️⃣ Вес\n5️⃣ Заметку\n\nВведите номер или «{cancel}».',
        en: 'Editing {petName}. What to change?\n1️⃣ Name\n2️⃣ Age\n3️⃣ Breed\n4️⃣ Weight\n5️⃣ Note\n\nEnter number or "{cancel}".',
        uk: 'Редагування {petName}. Що змінити?\n1️⃣ Ім\'я\n2️⃣ Вік\n3️⃣ Породу\n4️⃣ Вагу\n5️⃣ Нотатку\n\nВведіть номер або «{cancel}».',
    },
    editPetCancelled: { ru: 'Редактирование отменено.', en: 'Editing cancelled.', uk: 'Редагування скасовано.' },
    editPetNotFound: { ru: 'Питомец не найден.', en: 'Pet not found.', uk: 'Улюбленця не знайдено.' },
    editPetInvalidChoice: { ru: 'Введите число от 1 до 5.', en: 'Enter a number from 1 to 5.', uk: 'Введіть число від 1 до 5.' },
    editPetEnterNewValue: {
        ru: 'Введите новое значение для «{field}» или «{cancel}»:',
        en: 'Enter new value for "{field}" or "{cancel}":',
        uk: 'Введіть нове значення для «{field}» або «{cancel}»:',
    },
    editPetFieldName: { ru: 'имя', en: 'name', uk: "ім'я" },
    editPetFieldAge: { ru: 'возраст', en: 'age', uk: 'вік' },
    editPetFieldBreed: { ru: 'породу', en: 'breed', uk: 'породу' },
    editPetFieldWeight: { ru: 'вес (кг)', en: 'weight (kg)', uk: 'вагу (кг)' },
    editPetFieldNote: { ru: 'заметку', en: 'note', uk: 'нотатку' },
    editPetInvalidWeight: { ru: 'Некорректный вес. Попробуйте еще раз.', en: 'Invalid weight. Try again.', uk: 'Некоректна вага. Спробуйте ще раз.' },
    editPetSuccess: { ru: '✅ {petName} обновлен.', en: '✅ {petName} updated.', uk: '✅ {petName} оновлено.' },

    // ─── Edit event ───
    editEventCancelled: { ru: 'Редактирование отменено.', en: 'Editing cancelled.', uk: 'Редагування скасовано.' },
    editEventNotFound: { ru: 'Событие не найдено.', en: 'Event not found.', uk: 'Подію не знайдено.' },
    editEventInvalidWeight: { ru: 'Некорректный вес.', en: 'Invalid weight.', uk: 'Некоректна вага.' },
    editEventSuccess: { ru: '✅ Событие обновлено.', en: '✅ Event updated.', uk: '✅ Подію оновлено.' },

    // ─── Pet info ───
    petInfoBreed: { ru: 'Порода: {v}', en: 'Breed: {v}', uk: 'Порода: {v}' },
    petInfoAge: { ru: 'Возраст: {v}', en: 'Age: {v}', uk: 'Вік: {v}' },
    petInfoWeight: { ru: 'Вес: {v} кг', en: 'Weight: {v} kg', uk: 'Вага: {v} кг' },
    petInfoNote: { ru: 'Заметка: {v}', en: 'Note: {v}', uk: 'Нотатка: {v}' },
    petInfoRole: { ru: 'Роль: {v}', en: 'Role: {v}', uk: 'Роль: {v}' },
    editPetButton: { ru: '✏️ Редактировать', en: '✏️ Edit', uk: '✏️ Редагувати' },
    avatarButton: { ru: '📷 Аватар', en: '📷 Avatar', uk: '📷 Аватар' },
    addMorePets: { ru: 'Добавить ещё: /add_pet', en: 'Add more: /add_pet', uk: 'Додати ще: /add_pet' },
    noPetsAddViaCommand: {
        ru: 'У вас нет питомцев. Добавьте через /add_pet.',
        en: 'You have no pets. Add one via /add_pet.',
        uk: 'У вас немає улюбленців. Додайте через /add_pet.',
    },

    // ─── Share pet ───
    sharePetStartFirst: { ru: 'Сначала выполните /start и завершите onboarding.', en: 'Run /start and complete onboarding first.', uk: 'Спочатку виконайте /start і завершіть онбординг.' },
    sharePetNoPets: { ru: 'У вас пока нет доступных питомцев.', en: 'You have no available pets yet.', uk: 'У вас поки немає доступних улюбленців.' },
    sharePetOnlyOwner: { ru: 'Добавлять участников может только роль OWNER.', en: 'Only OWNER role can add members.', uk: 'Додавати учасників може тільки роль OWNER.' },
    sharePetUsage: {
        ru: 'Использование: /share_pet <telegram_id> [owner|caregiver|observer|trainer|vet] [tag]',
        en: 'Usage: /share_pet <telegram_id> [owner|caregiver|observer|trainer|vet] [tag]',
        uk: 'Використання: /share_pet <telegram_id> [owner|caregiver|observer|trainer|vet] [tag]',
    },
    sharePetUserNotFound: {
        ru: 'Пользователь не найден. Пусть сначала откроет бота и выполнит /start.',
        en: 'User not found. They need to open the bot and run /start first.',
        uk: 'Користувача не знайдено. Нехай спочатку відкриє бота і виконає /start.',
    },
    sharePetUnknownRole: {
        ru: 'Неизвестная роль. Доступно: owner, caregiver, observer, trainer, vet.',
        en: 'Unknown role. Available: owner, caregiver, observer, trainer, vet.',
        uk: 'Невідома роль. Доступні: owner, caregiver, observer, trainer, vet.',
    },
    sharePetSuccess: {
        ru: 'Доступ к питомцу {petName} выдан пользователю {telegramId} с ролью {role}.',
        en: 'Access to pet {petName} granted to user {telegramId} with role {role}.',
        uk: 'Доступ до улюбленця {petName} надано користувачу {telegramId} з роллю {role}.',
    },

    // ─── Photo / Avatar ───
    photoStartFirst: { ru: 'Сначала /start.', en: 'Run /start first.', uk: 'Спочатку /start.' },
    photoDownloadFailed: { ru: 'Не удалось загрузить фото.', en: 'Failed to download photo.', uk: 'Не вдалося завантажити фото.' },
    avatarUpdated: { ru: '✅ Аватар {petName} обновлён.', en: '✅ {petName} avatar updated.', uk: '✅ Аватар {petName} оновлено.' },
    avatarSetCancelled: { ru: 'Установка аватара отменена.', en: 'Avatar setting cancelled.', uk: 'Встановлення аватара скасовано.' },
    setAvatarOnlyOwner: { ru: 'Только владелец может менять аватар.', en: 'Only the owner can change the avatar.', uk: 'Тільки власник може змінювати аватар.' },
    photoNoPets: { ru: 'Нет питомцев.', en: 'No pets.', uk: 'Немає улюбленців.' },
    photoNoRecentEvents: {
        ru: 'Нет недавних событий, к которым можно прикрепить фото. Сначала запишите событие.',
        en: 'No recent events to attach a photo to. Record an event first.',
        uk: 'Немає нещодавніх подій, до яких можна прикріпити фото. Спочатку запишіть подію.',
    },
    photoMaxReached: {
        ru: 'К этому событию уже прикреплено 10 фото (максимум).',
        en: 'This event already has 10 photos (maximum).',
        uk: 'До цієї події вже прикріплено 10 фото (максимум).',
    },
    photoAttached: {
        ru: '📎 Фото прикреплено к последнему событию ({type}).',
        en: '📎 Photo attached to last event ({type}).',
        uk: '📎 Фото прикріплено до останньої події ({type}).',
    },

    // ─── Miniapp ───
    miniappNotConfigured: { ru: 'Мини-приложение не настроено.', en: 'Mini-app not configured.', uk: 'Міні-додаток не налаштовано.' },
    miniappOpenPrompt: { ru: 'Откройте мини-приложение:', en: 'Open the mini-app:', uk: 'Відкрийте міні-додаток:' },
    miniappOpenButton: { ru: '📱 Открыть Rix Logger', en: '📱 Open Rix Logger', uk: '📱 Відкрити Rix Logger' },

    // ─── Food reply ───
    replyFoodRecorded: { ru: '✅ Кормление записано.', en: '✅ Feeding recorded.', uk: '✅ Годування записано.' },
    replyWeightAsk: {
        ru: 'Введите вес в кг (например, 12.5) или «{cancel}».',
        en: 'Enter weight in kg (e.g. 12.5) or "{cancel}".',
        uk: 'Введіть вагу в кг (наприклад, 12.5) або «{cancel}».',
    },
    replyNoteAsk: {
        ru: 'Введите текст заметки или «{cancel}».',
        en: 'Enter note text or "{cancel}".',
        uk: 'Введіть текст нотатки або «{cancel}».',
    },

    // ─── Language ───
    replyLang: { ru: '🌐 Язык', en: '🌐 Language', uk: '🌐 Мова' },
    langPrompt: {
        ru: '🌐 Выберите язык:',
        en: '🌐 Choose language:',
        uk: '🌐 Оберіть мову:',
    },
    langChanged: {
        ru: '✅ Язык изменён на Русский.',
        en: '✅ Language changed to English.',
        uk: '✅ Мову змінено на Українську.',
    },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang, vars?: Record<string, string | number>): string {
    const entry = translations[key];
    if (!entry) return key;
    const template = (entry as Record<string, string>)[lang] ?? (entry as Record<string, string>).ru;
    if (!template) return key;
    if (!vars) return template;
    return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), template);
}

export function tList(key: 'yesWords' | 'noWords', lang: Lang): readonly string[] {
    const entry = translations[key];
    return (entry as Record<string, readonly string[]>)[lang] ?? (entry as Record<string, readonly string[]>).ru;
}

export function toLang(languageCode: string | undefined): Lang {
    if (!languageCode) return 'uk';
    const lc = languageCode.toLowerCase().slice(0, 2);
    if (lc === 'en') return 'en';
    if (lc === 'ru') return 'ru';
    return 'uk';
}
