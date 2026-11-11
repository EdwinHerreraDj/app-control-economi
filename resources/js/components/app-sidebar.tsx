import { Link, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Gauge,
    HandCoins,
    Repeat,
    Target,
    Landmark,
    LayoutGrid,
    ScrollText,
    Shapes,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as auditIndex } from '@/routes/admin/audit';
import { index as usersIndex } from '@/routes/admin/users';
import { index as accountsIndex } from '@/routes/accounts';
import { index as budgetsIndex } from '@/routes/budgets';
import { index as debtsIndex } from '@/routes/debts';
import { index as goalsIndex } from '@/routes/goals';
import { index as recurringIndex } from '@/routes/recurring';
import { index as categoriesIndex } from '@/routes/categories';
import { index as transactionsIndex } from '@/routes/transactions';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Panel',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Movimientos',
        href: transactionsIndex(),
        icon: ArrowLeftRight,
    },
    {
        title: 'Cuentas',
        href: accountsIndex(),
        icon: Landmark,
    },
    {
        title: 'Categorías',
        href: categoriesIndex(),
        icon: Shapes,
    },
];

const planningNavItems: NavItem[] = [
    {
        title: 'Recurrentes',
        href: recurringIndex(),
        icon: Repeat,
    },
    {
        title: 'Presupuestos',
        href: budgetsIndex(),
        icon: Gauge,
    },
    {
        title: 'Objetivos',
        href: goalsIndex(),
        icon: Target,
    },
    {
        title: 'Deudas',
        href: debtsIndex(),
        icon: HandCoins,
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'Usuarios',
        href: usersIndex(),
        icon: Users,
    },
    {
        title: 'Auditoría',
        href: auditIndex(),
        icon: ScrollText,
    },
];

export function AppSidebar() {
    const { auth } = usePage().props;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain label="Mis finanzas" items={mainNavItems} />
                <NavMain label="Planificación" items={planningNavItems} />
                {auth.can.administer && (
                    <NavMain label="Administración" items={adminNavItems} />
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
