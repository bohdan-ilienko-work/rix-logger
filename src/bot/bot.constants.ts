export const SKIP_KEYWORD = 'пропустить';
export const CANCEL_KEYWORD = 'отмена';

export const REPLY_BUTTONS = {
    WALK: '🦮 Прогулка',
    FOOD: '🍽 Еда',
    WEIGHT: '⚖️ Вес',
    NOTE: '📝 Заметка',
    STATS: '📊 Статистика',
    PETS: '🐾 Питомцы',
    INVITE: '👥 Пригласить',
    MINIAPP: '📱 Мини-приложение',
} as const;

export const MENU_CALLBACKS = {
    WALK: 'menu_walk',
    FOOD: 'menu_food',
    WEIGHT: 'menu_weight',
    NOTE: 'menu_note',
    STATS_TODAY: 'menu_stats_today',
    BACK: 'menu_back',
    PETS_LIST: 'menu_pets_list',
    INVITE: 'menu_invite',
    EDIT_PET: 'menu_edit_pet',
    DELETE_LAST_EVENT: 'menu_delete_last_event',
} as const;
