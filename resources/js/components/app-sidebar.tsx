import { Link, usePage } from '@inertiajs/react';
import {
    ArrowDownToLine,
    ArrowLeftRight,
    ArrowUpFromLine,
    CalendarCheck,
    CalendarDays,
    ChartColumn,
    Gauge,
    House,
    Landmark,
    Palette,
    PawPrint,
    Plus,
    ScrollText,
    Shapes,
    Target,
    Users,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { openQuick } from '@/components/quick/quick-store';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { dashboard, statistics } from '@/routes';
import { index as accountsIndex } from '@/routes/accounts';
import { index as auditIndex } from '@/routes/admin/audit';
import { edit as brandingEdit } from '@/routes/admin/branding';
import { index as mascotsIndex } from '@/routes/admin/mascots';
import { index as usersIndex } from '@/routes/admin/users';
import { index as budgetsIndex } from '@/routes/budgets';
import { index as categoriesIndex } from '@/routes/categories';
import { index as expensesIndex } from '@/routes/expenses';
import { index as goalsIndex } from '@/routes/goals';
import { index as incomesIndex } from '@/routes/incomes';
import { index as monthsIndex } from '@/routes/months';
import { index as paymentsIndex } from '@/routes/payments';
import { index as transactionsIndex } from '@/routes/transactions';
import type { NavItem } from '@/types';

/** Lo esencial: gastos e ingresos por separado, pagos y meses. */
export const mainNavItems: NavItem[] = [
    { title: 'Inicio', href: dashboard(), icon: House },
    { title: 'Gastos', href: expensesIndex(), icon: ArrowUpFromLine },
    { title: 'Ingresos', href: incomesIndex(), icon: ArrowDownToLine },
    { title: 'Mis pagos', href: paymentsIndex(), icon: CalendarCheck },
    { title: 'Mis meses', href: monthsIndex(), icon: CalendarDays },
];

/** Herramientas para quien quiera más detalle; no estorban al resto. */
export const moreNavItems: NavItem[] = [
    {
        title: 'Todos los movimientos',
        href: transactionsIndex(),
        icon: ArrowLeftRight,
    },
    { title: 'Mis cuentas', href: accountsIndex(), icon: Landmark },
    { title: 'Categorías', href: categoriesIndex(), icon: Shapes },
    { title: 'Estadísticas', href: statistics(), icon: ChartColumn },
    { title: 'Presupuestos', href: budgetsIndex(), icon: Gauge },
    { title: 'Metas de ahorro', href: goalsIndex(), icon: Target },
];

const adminNavItems: NavItem[] = [
    { title: 'Usuarios', href: usersIndex(), icon: Users },
    { title: 'Auditoría', href: auditIndex(), icon: ScrollText },
    { title: 'Identidad visual', href: brandingEdit(), icon: Palette },
    { title: 'Mascotas', href: mascotsIndex(), icon: PawPrint },
];

export function AppSidebar() {
    const { auth } = usePage().props;
    const { setOpenMobile } = useSidebar();

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link
                                href={dashboard()}
                                prefetch
                                onClick={() => setOpenMobile(false)}
                            >
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            tooltip="Apuntar"
                            onClick={() => {
                                setOpenMobile(false);
                                openQuick('menu');
                            }}
                            className="mt-2 bg-primary font-medium text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        >
                            <Plus aria-hidden="true" />
                            <span>Apuntar</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain label="Mi dinero" items={mainNavItems} eager />
                <NavMain label="Más" items={moreNavItems} />
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
