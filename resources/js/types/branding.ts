export type Brand = {
    name: string;
    short_name: string;
    /** Solo presentes si el superusuario ha subido los suyos. */
    logo: string | null;
    logo_dark: string | null;
    logo_square: string | null;
};

export type MascotStateName =
    | 'cover'
    | 'idle'
    | 'welcome'
    | 'celebration'
    | 'attention'
    | 'support'
    | 'unknown';

export type MascotImages = Record<
    MascotStateName,
    { static: string | null; animated: string | null; own: boolean }
>;

export type MascotCompanionData = {
    id: number;
    name: string;
    images: MascotImages;
    state: Exclude<MascotStateName, 'cover' | 'welcome' | 'celebration'>;
    transient: 'welcome' | 'celebration' | null;
    reason: string;
    message: string | null;
    visibility: 'shown' | 'minimized' | 'hidden';
    motion: 'full' | 'reduced' | 'none';
};
