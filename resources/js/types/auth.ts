export type UserRole = 'superuser' | 'user';

export type UserStatus = 'pending' | 'active' | 'suspended';

export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    role: UserRole;
    status: UserStatus;
    email_verified_at: string | null;
    currency: string | null;
    onboarded_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
    can: {
        administer: boolean;
    };
};
