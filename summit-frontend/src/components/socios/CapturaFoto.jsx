import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CameraOff, Check, Loader2, RefreshCw, Upload } from 'lucide-react';
import Modal from '../Modal';
import { botonPrimario, botonSecundario } from '../Campo';

const LADO = 480;          // las fotos se guardan cuadradas, de 480 px (el servidor igual las vuelve a revisar)
const LADO_MINIMO = 120;   // el mismo mínimo que controla el servidor
const CALIDAD_JPG = 0.88;

// Recorta el centro en un cuadrado y lo lleva a LADO px: así todas las fotos quedan iguales y livianas.
// Dibujar en un canvas además descarta los datos ocultos de la imagen original (como el lugar donde se sacó).
const recortar = (fuente, ancho, alto) => new Promise((resolve, reject) => {
  const lado = Math.min(ancho, alto);
  const lienzo = document.createElement('canvas');
  lienzo.width = LADO;
  lienzo.height = LADO;
  lienzo.getContext('2d').drawImage(fuente, (ancho - lado) / 2, (alto - lado) / 2, lado, lado, 0, 0, LADO, LADO);
  lienzo.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la foto'))), 'image/jpeg', CALIDAD_JPG);
});

const textoErrorCamara = (error) => {
  if (error?.name === 'NotAllowedError') return 'El navegador no tiene permiso para usar la cámara.';
  if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') return 'No se encontró una cámara.';
  if (error?.name === 'NotReadableError') return 'La cámara está siendo usada por otro programa.';
  return 'No se pudo usar la cámara.';
};

/**
 * Sacar la foto del socio con la cámara de la PC (o elegir una imagen, por ejemplo desde el celular), revisarla y
 * confirmarla. onListo(blob) recibe un JPG cuadrado y puede devolver { ok, error }: si falla, el error se muestra
 * acá y se puede reintentar. Quien la abre la cierra cuando terminó (onCerrar para cancelar).
 * Va en el <body> (portal): dentro de otra ventana, como la ficha del socio, quedaría recortada.
 */
const CapturaFoto = ({ nombre, onListo, onCerrar, subtitulo = 'Para que recepción lo reconozca cuando entra. Se guarda en la PC del gimnasio.' }) => {
  // camara: se ve la cámara | sinCamara: no se puede usar | revisar: foto sacada | guardando
  const [paso, setPaso] = useState('camara');
  const [error, setError] = useState('');
  const [motivoSinCamara, setMotivoSinCamara] = useState('');
  const [foto, setFoto] = useState(null); // { blob, url }
  const [camaraLista, setCamaraLista] = useState(false);
  const videoRef = useRef(null);
  const archivoRef = useRef(null);

  // Con el paso "camara" se prende la cámara (la frontal, si es un celular); al salir del paso se apaga
  useEffect(() => {
    if (paso !== 'camara') return undefined;
    if (!navigator.mediaDevices?.getUserMedia) {
      // Fuera de esta PC (localhost) o sin https, el navegador no deja usar la cámara
      setMotivoSinCamara('La cámara solo funciona si el panel se abre en esta PC o con https.');
      setPaso('sinCamara');
      return undefined;
    }
    let cancelado = false;
    let stream = null;
    setCamaraLista(false);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(async (s) => {
        stream = s;
        if (cancelado) {
          s.getTracks().forEach((pista) => pista.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = s;
        await video.play().catch(() => {});
        if (!cancelado) setCamaraLista(true);
      })
      .catch((e) => {
        if (cancelado) return;
        setMotivoSinCamara(textoErrorCamara(e));
        setPaso('sinCamara');
      });
    return () => {
      cancelado = true;
      stream?.getTracks().forEach((pista) => pista.stop());
    };
  }, [paso]);

  // La dirección blob: de la foto en revisión se libera al reemplazarla o al cerrar
  useEffect(() => () => { if (foto) URL.revokeObjectURL(foto.url); }, [foto]);

  const mostrar = (blob) => {
    setFoto({ blob, url: URL.createObjectURL(blob) });
    setError('');
    setPaso('revisar');
  };

  const sacar = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    try {
      mostrar(await recortar(video, video.videoWidth, video.videoHeight));
    } catch (e) {
      setError(e.message);
    }
  };

  const elegirArchivo = (archivo) => {
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = async () => {
      URL.revokeObjectURL(url);
      if (Math.min(imagen.naturalWidth, imagen.naturalHeight) < LADO_MINIMO) {
        setError(`La imagen es muy chica: elegí una de al menos ${LADO_MINIMO} px de lado.`);
        return;
      }
      try {
        mostrar(await recortar(imagen, imagen.naturalWidth, imagen.naturalHeight));
      } catch (e) {
        setError(e.message);
      }
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      setError('No se pudo abrir la imagen: probá con una JPG o PNG.');
    };
    imagen.src = url;
  };

  const usar = async () => {
    setPaso('guardando');
    setError('');
    const r = await onListo(foto.blob);
    if (r && !r.ok) {
      setError(r.error);
      setPaso('revisar');
    }
  };

  const otraVez = () => {
    setError('');
    setPaso(motivoSinCamara ? 'sinCamara' : 'camara');
  };

  const botonArchivo = (clase) => (
    <button type="button" onClick={() => archivoRef.current?.click()} className={clase}>
      <Upload className="w-4 h-4" /> Subir una imagen
    </button>
  );

  let pie;
  if (paso === 'camara') {
    pie = (<>
      {botonArchivo(botonSecundario)}
      <button type="button" onClick={onCerrar} className={botonSecundario}>Cancelar</button>
      <button type="button" onClick={sacar} disabled={!camaraLista} className={botonPrimario}>
        <Camera className="w-4 h-4" /> Sacar foto
      </button>
    </>);
  } else if (paso === 'sinCamara') {
    pie = (<>
      <button type="button" onClick={onCerrar} className={botonSecundario}>Cancelar</button>
      {botonArchivo(botonPrimario)}
    </>);
  } else {
    pie = (<>
      <button type="button" onClick={otraVez} disabled={paso === 'guardando'} className={botonSecundario}>
        <RefreshCw className="w-4 h-4" /> {motivoSinCamara ? 'Elegir otra' : 'Sacar otra'}
      </button>
      <button type="button" onClick={usar} disabled={paso === 'guardando'} className={botonPrimario}>
        {paso === 'guardando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {paso === 'guardando' ? 'Guardando...' : 'Usar esta foto'}
      </button>
    </>);
  }

  return createPortal(
    <Modal titulo={nombre ? `Foto de ${nombre}` : 'Foto del socio'} subtitulo={subtitulo}
      onClose={onCerrar} ancho="max-w-md" pie={pie}>
      <div className="space-y-3">
        {paso === 'camara' && (
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-900">
            {/* Espejada, como un espejo: así el socio se acomoda solo. La foto se guarda sin espejar */}
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover -scale-x-100" />
            {/* Guía para la cara: lo que queda afuera del cuadrado no sale en la foto */}
            <div className="absolute inset-[16%] rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)] pointer-events-none" />
            {!camaraLista && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Prendiendo la cámara...
              </div>
            )}
          </div>
        )}
        {paso === 'sinCamara' && (
          <div className="aspect-square w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <CameraOff className="w-8 h-8 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">{motivoSinCamara}</p>
            <p className="text-sm text-slate-500">Podés subir una imagen: desde un celular, te deja sacarla en el momento.</p>
          </div>
        )}
        {(paso === 'revisar' || paso === 'guardando') && foto && (
          <img src={foto.url} alt="Foto sacada" className="aspect-square w-full rounded-xl object-cover bg-slate-100" />
        )}
        {paso === 'camara' && <p className="text-xs text-slate-500 text-center">Que la cara quede dentro del círculo, de frente y con buena luz.</p>}
        {error && <p className="text-sm font-medium text-rose-700" role="alert">{error}</p>}
        <input ref={archivoRef} type="file" accept="image/*" className="hidden" aria-label="Elegir una imagen"
          onChange={(e) => { elegirArchivo(e.target.files[0]); e.target.value = ''; }} />
      </div>
    </Modal>,
    document.body,
  );
};

export default CapturaFoto;
