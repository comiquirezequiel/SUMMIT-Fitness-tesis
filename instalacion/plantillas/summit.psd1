# Configuración de los scripts de SUMMIT en esta PC (copias de seguridad, restauración, chequeo y servicios).
# Acá NO van contraseñas: esas quedan cifradas en config\secretos-copias.dat y en app\config\application.properties.
# Se puede editar con el Bloc de notas. Los textos van entre comillas simples y los números sin comillas.
@{
    # Carpeta donde está instalado SUMMIT
    Raiz                  = 'C:\SUMMIT'

    # --- MySQL ---
    # Carpeta de los programas de MySQL (mysql.exe y mysqldump.exe)
    MysqlBin              = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
    MysqlServidor         = '127.0.0.1'
    MysqlPuerto           = 3306
    # Nombre del servicio de MySQL en Windows (se ve en services.msc)
    MysqlServicio         = 'MySQL84'
    # Base de datos de SUMMIT
    Base                  = 'summit_fitness_db'

    # --- Archivos subidos (certificados médicos y fotos de los socios) ---
    # Tiene que ser la misma carpeta que summit.uploads.dir en app\config\application.properties
    CarpetaUploads        = 'C:\SUMMIT\datos\uploads'

    # --- Copias de seguridad ---
    # Dónde quedan las copias en esta PC
    CarpetaCopias         = 'C:\SUMMIT\copias'
    # Se borran las copias con más días que esto...
    DiasRetencion         = 30
    # ...pero siempre quedan por lo menos estas (las más nuevas), aunque sean viejas
    CopiasMinimas         = 7
    # Copia extra fuera de esta PC (vacío = no se hace). Ejemplos:
    #   una carpeta que sube OneDrive:            'C:\Users\Recepcion\OneDrive\SUMMIT-copias'
    #   una carpeta que sube Google Drive:        'C:\SUMMIT\copias-nube'  (ver INSTALACION.md)
    #   un disco USB (letra E:):                  'E:\SUMMIT-copias'
    DestinoExterno        = ''
    # Días que se guardan en el destino externo (0 = no se borra nunca nada ahí)
    DiasRetencionExterno  = 30
    # Programa 7-Zip
    SieteZip              = 'C:\Program Files\7-Zip\7z.exe'
    # Archivo con las claves de las copias, cifrado por Windows (lo crean crear-usuarios-mysql.ps1 y guardar-clave-copias.ps1)
    ArchivoSecretos       = 'C:\SUMMIT\config\secretos-copias.dat'
    # Registros (logs) de las copias, la restauración y los servicios
    CarpetaRegistros      = 'C:\SUMMIT\logs'
    # Carpeta de trabajo para restaurar copias (se vacía al terminar)
    CarpetaRestauraciones = 'C:\SUMMIT\restauraciones'

    # --- Chequeo (doctor.ps1) ---
    # Avisa si la última copia tiene más horas que esto
    HorasAvisoCopia       = 30
    # Avisa si a un disco le quedan menos GB libres que esto
    EspacioMinimoGB       = 5

    # --- Servicios y direcciones ---
    ServicioBackend       = 'SUMMIT-Backend'
    ServicioWeb           = 'SUMMIT-Web'
    UrlBackend            = 'http://127.0.0.1:8080'
    # Con https (el Caddyfile de siempre). Si se instaló sin https: 'http://localhost'
    UrlWeb                = 'https://localhost'
    TareaCopia            = 'SUMMIT - Copia de seguridad'

    # --- Asistente de IA (opcional) ---
    UrlOllama             = 'http://127.0.0.1:11434'
    ModeloIa              = 'gemma4:12b'
}
