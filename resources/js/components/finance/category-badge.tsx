import type { LucideIcon } from 'lucide-react';
import {
    Baby,
    BookOpen,
    Briefcase,
    Bus,
    Car,
    CircleEllipsis,
    CirclePlus,
    Coffee,
    Dog,
    Dumbbell,
    Gift,
    GraduationCap,
    HeartPulse,
    House,
    Landmark,
    Laptop,
    PartyPopper,
    Percent,
    PiggyBank,
    Plane,
    RotateCcw,
    Shield,
    Shirt,
    ShoppingCart,
    Smartphone,
    Tag,
    Utensils,
    Wallet,
    Wrench,
    Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Iconos disponibles (deben coincidir con config/finance.php). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
    briefcase: Briefcase,
    laptop: Laptop,
    tag: Tag,
    'rotate-ccw': RotateCcw,
    'circle-plus': CirclePlus,
    house: House,
    zap: Zap,
    'shopping-cart': ShoppingCart,
    utensils: Utensils,
    coffee: Coffee,
    car: Car,
    bus: Bus,
    plane: Plane,
    'heart-pulse': HeartPulse,
    'graduation-cap': GraduationCap,
    'party-popper': PartyPopper,
    shirt: Shirt,
    smartphone: Smartphone,
    shield: Shield,
    landmark: Landmark,
    percent: Percent,
    gift: Gift,
    baby: Baby,
    dog: Dog,
    dumbbell: Dumbbell,
    wrench: Wrench,
    'piggy-bank': PiggyBank,
    wallet: Wallet,
    'book-open': BookOpen,
    'circle-ellipsis': CircleEllipsis,
};

/** Clases completas para que Tailwind las detecte. Sin rojo: se reserva para errores. */
export const CATEGORY_COLORS: Record<string, string> = {
    teal: 'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200',
    emerald:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
    lime: 'bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-400/15 dark:text-orange-200',
    pink: 'bg-pink-100 text-pink-800 dark:bg-pink-400/15 dark:text-pink-200',
    violet: 'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200',
    sky: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200',
    slate: 'bg-slate-200 text-slate-800 dark:bg-slate-400/20 dark:text-slate-200',
};

export const COLOR_LABELS: Record<string, string> = {
    teal: 'Verde azulado',
    emerald: 'Esmeralda',
    lime: 'Lima',
    amber: 'Ámbar',
    orange: 'Naranja',
    pink: 'Rosa',
    violet: 'Violeta',
    indigo: 'Índigo',
    sky: 'Celeste',
    slate: 'Gris',
};

export function CategoryIcon({
    icon,
    color,
    className,
}: {
    icon: string;
    color: string;
    className?: string;
}) {
    const Icon = CATEGORY_ICONS[icon] ?? Tag;

    return (
        <span
            className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-xl',
                CATEGORY_COLORS[color] ?? CATEGORY_COLORS.slate,
                className,
            )}
            aria-hidden="true"
        >
            <Icon className="size-4.5" />
        </span>
    );
}
