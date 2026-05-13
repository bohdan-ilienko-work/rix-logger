import { PetEventType } from '../pet-events/entities/pet-event.entity';

export enum OnboardingStep {
    WAITING_CONTACT = 'WAITING_CONTACT',
    WAITING_PET_NAME = 'WAITING_PET_NAME',
    WAITING_PET_AGE = 'WAITING_PET_AGE',
    WAITING_PET_BREED = 'WAITING_PET_BREED',
    WAITING_PET_WEIGHT = 'WAITING_PET_WEIGHT',
    WAITING_PET_NOTE = 'WAITING_PET_NOTE',
    COMPLETED = 'COMPLETED',
}

export interface OnboardingPetData {
    name?: string;
    age?: string | null;
    breed?: string | null;
    weightKg?: number | null;
    note?: string | null;
}

export interface OnboardingSession {
    step: OnboardingStep;
    data: OnboardingPetData;
}

export interface PendingEventSession {
    type: PetEventType.WEIGHT | PetEventType.NOTE;
}

export enum WalkLogStep {
    WAITING_DURATION_MINUTES = 'WAITING_DURATION_MINUTES',
    WAITING_END_TIME = 'WAITING_END_TIME',
    WAITING_POOP = 'WAITING_POOP',
    WAITING_PEE = 'WAITING_PEE',
    WAITING_NOTE = 'WAITING_NOTE',
}

export interface WalkLogData {
    endTime?: string;
    durationMinutes?: number;
    pooped?: boolean;
    peed?: boolean;
    note?: string | null;
}

export interface WalkLogSession {
    step: WalkLogStep;
    data: WalkLogData;
}

export enum EditPetStep {
    WAITING_FIELD_CHOICE = 'WAITING_FIELD_CHOICE',
    WAITING_NEW_VALUE = 'WAITING_NEW_VALUE',
}

export interface EditPetSession {
    step: EditPetStep;
    petId: string;
    field?: 'name' | 'age' | 'breed' | 'weightKg' | 'note';
}

export enum FoodLogStep {
    WAITING_FOOD_TYPE = 'WAITING_FOOD_TYPE',
    WAITING_AMOUNT = 'WAITING_AMOUNT',
    WAITING_APPETITE = 'WAITING_APPETITE',
    WAITING_NOTE = 'WAITING_NOTE',
}

export interface FoodLogData {
    foodType?: string;
    amount?: string;
    appetite?: string;
    note?: string | null;
}

export interface FoodLogSession {
    step: FoodLogStep;
    data: FoodLogData;
}

export interface EditEventSession {
    eventId: string;
}
