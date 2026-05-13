export const SKIP_KEYWORD = 'пропустить';
export const CANCEL_KEYWORD = 'отмена';

export const REPLY_BUTTONS = {
    WALK: '🦮 Прогулка',
    FOOD: '🍽 Еда',
    WEIGHT: '⚖️ Вес',
    NOTE: '📝 Заметка',
    EVENTS: '📋 События',
    STATS: '📊 Статистика',
    PETS: '🐾 Питомцы',
    MEMBERS: '👥 Участники',
    MINIAPP: '📱 Мини-приложение',
} as const;

export const MENU_CALLBACKS = {
    WALK: 'menu_walk',
    FOOD: 'menu_food',
    WEIGHT: 'menu_weight',
    NOTE: 'menu_note',
    STATS_TODAY: 'menu_stats_today',
    STATS_7D: 'menu_stats_7d',
    STATS_30D: 'menu_stats_30d',
    BACK: 'menu_back',
    PETS_LIST: 'menu_pets_list',
    INVITE: 'menu_invite',
    EDIT_PET: 'menu_edit_pet',
    DELETE_PET: 'menu_delete_pet',
    DELETE_LAST_EVENT: 'menu_delete_last_event',
    CONFIRM_DELETE_PET: 'confirm_del_pet_',
    EVT_FILTER_ALL: 'evt_filter_all',
    EVT_FILTER_WALK: 'evt_filter_walk',
    EVT_FILTER_FOOD: 'evt_filter_food',
    EVT_FILTER_WEIGHT: 'evt_filter_weight',
    EVT_FILTER_NOTE: 'evt_filter_note',
    EVT_SORT_TOGGLE: 'evt_sort_toggle',
} as const;
