import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, ExternalLink, Smartphone } from 'lucide-react';

/**
 * QR del link de Mercado Pago: el socio lo escanea con el celular y autoriza el débito automático
 * eligiendo con qué pagar (dinero en cuenta o una tarjeta de su banco o billetera).
 */
const QrAutorizacion = ({ link }) => {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Navegador sin acceso al portapapeles: queda el botón "Abrir"
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white">
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 shrink-0">
        <QRCodeSVG value={link} size={148} level="M" />
      </div>
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-slate-800 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-sky-600" /> Escaneá con el celular para autorizar
        </p>
        <ol className="text-slate-600 text-xs space-y-1 list-decimal list-inside">
          <li>Se abre Mercado Pago y el socio entra a su cuenta.</li>
          <li>Elige con qué pagar: dinero en cuenta o una tarjeta de débito, crédito o prepaga.</li>
          <li>Confirma, y después tocás "Actualizar estado".</li>
        </ol>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={copiar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
          <a href={link} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Abrir <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default QrAutorizacion;
