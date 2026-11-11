import { router } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    url: string;
    accept: string;
    label: string;
    /** Datos extra que acompañan al archivo (p. ej. variante). */
    data?: Record<string, string>;
    variant?: 'default' | 'outline' | 'secondary';
};

/**
 * Botón de subida: valida en el servidor y muestra el motivo si se rechaza.
 */
export function FileUpload({
    url,
    accept,
    label,
    data = {},
    variant = 'outline',
}: Props) {
    const inputId = useId();
    const input = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <div className="grid gap-1">
            <input
                ref={input}
                id={inputId}
                type="file"
                accept={accept}
                className="sr-only"
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (!file) {
                        return;
                    }

                    setError(null);
                    router.post(
                        url,
                        { ...data, file },
                        {
                            forceFormData: true,
                            preserveScroll: true,
                            onStart: () => setUploading(true),
                            onFinish: () => {
                                setUploading(false);

                                if (input.current) {
                                    input.current.value = '';
                                }
                            },
                            onError: (errors) =>
                                setError(
                                    errors.file ??
                                        Object.values(errors)[0] ??
                                        'No se pudo subir el archivo.',
                                ),
                        },
                    );
                }}
            />
            <Button
                type="button"
                size="sm"
                variant={variant}
                disabled={uploading}
                onClick={() => input.current?.click()}
            >
                {uploading ? <Spinner /> : <Upload aria-hidden="true" />}
                {label}
            </Button>
            <InputError message={error ?? undefined} />
        </div>
    );
}
