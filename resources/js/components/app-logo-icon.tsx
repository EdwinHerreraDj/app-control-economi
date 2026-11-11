import type { SVGAttributes } from 'react';

/**
 * Icono provisional: una hoja que brota de una moneda (crecimiento sereno).
 * El superusuario podrá sustituir la identidad visual en la fase 7.
 */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            <path d="M16 30a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-3a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
            <path d="M16.9 13.2c.2-4.6 2.8-8.4 8.6-10.2.6 5.8-2.6 9.6-8.6 10.2Z" />
            <path d="M15.1 11.4C10.4 11 7.6 8.4 7 4.4c4.3.2 7.3 2.4 8.1 7Z" />
        </svg>
    );
}
