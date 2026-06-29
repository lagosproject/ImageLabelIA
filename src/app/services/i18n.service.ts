import { Injectable, signal } from '@angular/core';

export type Lang = 'en' | 'es' | 'fr';

const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  en: {
    'btn.auto_tag': 'Auto-Tag Folder',
    'btn.cancel': 'Cancel',
    'tooltip.config': 'Configure batch auto-tagging options',
    'label.route': 'Route:',
    'tooltip.go_parent': 'Go to Parent Folder',
    'tooltip.go_root': 'Go to Root',
    'tooltip.browse': 'Browse folder natively',
    'btn.browse': 'Browse Folder',
    'sidebar.folders': 'Folders',
    'sidebar.no_subfolders': 'No subfolders found',
    'sidebar.collapse': 'Collapse Panel',
    'sidebar.switch_drive': 'Switch Drive',
    'sidebar.expand_folders': 'Expand Folders Panel',
    'sidebar.expand_details': 'Expand Details Panel',
    'gallery.title': 'Gallery',
    'gallery.images': 'images',
    'gallery.empty': 'No Folder Opened',
    'gallery.empty_sub': 'Please select a folder to begin scanning and cataloging your images.',
    'gallery.scanning': 'Scanning folder and indexing images...',
    'gallery.no_images': 'No supported images found in this folder.',
    'gallery.search': 'Search images by name...',
    'gallery.no_match': 'No images match your search query "{query}"',
    'details.title': 'Selected Image',
    'details.path': 'File Path',
    'details.size': 'File Size',
    'details.dimensions': 'Dimensions',
    'details.keywords': 'Keywords',
    'details.no_keywords': 'No keywords added yet.',
    'details.add_tag_placeholder': 'Add Tag...',
    'details.exif_model': 'Model',
    'details.exif_date': 'Date Time',
    'details.exif_exposure': 'Exposure Time',
    'details.exif_iso': 'ISO Speed',
    'details.exif_aperture': 'Aperture',
    'details.exif_focal': 'Focal Length',
    'details.ai_generate': 'Generate AI Tags',
    'details.ai_suggested': 'AI Suggested Keywords',
    'details.btn_save': 'Save',
    'details.btn_apply': 'Apply Tags',
    'details.tooltip_apply': 'Click to write these keywords to the image metadata',
    'details.empty': 'No Image Selected',
    'details.empty_sub': 'Select an image from the gallery to view metadata, EXIF details, and run AI tagging.',
    'modal.config_title': 'Batch Auto-Tagging Options',
    'modal.config_mode': 'Tagging Mode',
    'modal.config_mode_skip': 'Skip already tagged images',
    'modal.config_mode_append': 'Append new tags to existing ones',
    'modal.config_mode_overwrite': 'Overwrite all existing tags',
    'modal.config_max_tags': 'Max tags per image',
    'modal.config_depth': 'Folder Scan Depth',
    'modal.config_depth_current': 'Current folder only',
    'modal.config_depth_recursive': 'Recursive (up to depth {depth})',
    'modal.config_start': 'Start Batch Tagging',
    'modal.config_close': 'Close',
    'modal.report_title': 'Batch Tagging Report',
    'modal.report_status': 'Status',
    'modal.report_total': 'Total Images',
    'modal.report_processed': 'Processed',
    'modal.report_success': 'Successes',
    'modal.report_failures': 'Failures',
    'modal.report_added': 'Tags Added',
    'modal.report_removed': 'Tags Removed',
    'modal.report_duration': 'Duration',
    'modal.report_errors': 'Errors encountered',
    'modal.report_done': 'Done'
  },
  es: {
    'btn.auto_tag': 'Etiquetar carpeta',
    'btn.cancel': 'Cancelar',
    'tooltip.config': 'Configurar opciones de etiquetado por lotes',
    'label.route': 'Ruta:',
    'tooltip.go_parent': 'Ir a la carpeta superior',
    'tooltip.go_root': 'Ir al inicio',
    'tooltip.browse': 'Buscar carpeta de forma nativa',
    'btn.browse': 'Buscar carpeta',
    'sidebar.folders': 'Carpetas',
    'sidebar.no_subfolders': 'No se encontraron subcarpetas',
    'sidebar.collapse': 'Contraer panel',
    'sidebar.switch_drive': 'Cambiar disco',
    'sidebar.expand_folders': 'Expandir panel de carpetas',
    'sidebar.expand_details': 'Expandir panel de detalles',
    'gallery.title': 'Galería',
    'gallery.images': 'imágenes',
    'gallery.empty': 'Ninguna carpeta abierta',
    'gallery.empty_sub': 'Por favor, selecciona una carpeta para comenzar a escanear y catalogar tus imágenes.',
    'gallery.scanning': 'Escaneando carpeta e indexando imágenes...',
    'gallery.no_images': 'No se encontraron imágenes compatibles en esta carpeta.',
    'gallery.search': 'Buscar imágenes por nombre...',
    'gallery.no_match': 'Ninguna imagen coincide con tu búsqueda "{query}"',
    'details.title': 'Imagen seleccionada',
    'details.path': 'Ruta del archivo',
    'details.size': 'Tamaño',
    'details.dimensions': 'Dimensiones',
    'details.keywords': 'Palabras clave',
    'details.no_keywords': 'Aún no se han añadido palabras clave.',
    'details.add_tag_placeholder': 'Añadir etiqueta...',
    'details.exif_model': 'Modelo',
    'details.exif_date': 'Fecha y hora',
    'details.exif_exposure': 'Tiempo de exposición',
    'details.exif_iso': 'Velocidad ISO',
    'details.exif_aperture': 'Apertura',
    'details.exif_focal': 'Distancia focal',
    'details.ai_generate': 'Generar etiquetas con IA',
    'details.ai_suggested': 'Sugerencias de palabras clave de IA',
    'details.btn_save': 'Guardar',
    'details.btn_apply': 'Aplicar etiquetas',
    'details.tooltip_apply': 'Haga clic para escribir estas palabras clave en los metadatos de la imagen',
    'details.empty': 'Ninguna imagen seleccionada',
    'details.empty_sub': 'Selecciona una imagen de la galería para ver sus metadatos, detalles EXIF y ejecutar el etiquetado con IA.',
    'modal.config_title': 'Opciones de etiquetado por lotes',
    'modal.config_mode': 'Modo de etiquetado',
    'modal.config_mode_skip': 'Omitir imágenes ya etiquetadas',
    'modal.config_mode_append': 'Añadir nuevas etiquetas a las existentes',
    'modal.config_mode_overwrite': 'Sobrescribir todas las etiquetas existentes',
    'modal.config_max_tags': 'Máx. etiquetas por imagen',
    'modal.config_depth': 'Profundidad de escaneo',
    'modal.config_depth_current': 'Solo carpeta actual',
    'modal.config_depth_recursive': 'Recursivo (hasta profundidad {depth})',
    'modal.config_start': 'Iniciar etiquetado',
    'modal.config_close': 'Cerrar',
    'modal.report_title': 'Informe de etiquetado por lotes',
    'modal.report_status': 'Estado',
    'modal.report_total': 'Total de imágenes',
    'modal.report_processed': 'Procesadas',
    'modal.report_success': 'Éxitos',
    'modal.report_failures': 'Fallos',
    'modal.report_added': 'Etiquetas añadidas',
    'modal.report_removed': 'Etiquetas eliminadas',
    'modal.report_duration': 'Duración',
    'modal.report_errors': 'Errores detectados',
    'modal.report_done': 'Listo'
  },
  fr: {
    'btn.auto_tag': 'Étiqueter le dossier',
    'btn.cancel': 'Annuler',
    'tooltip.config': 'Configurer les options d\'étiquetage par lot',
    'label.route': 'Chemin:',
    'tooltip.go_parent': 'Aller au dossier parent',
    'tooltip.go_root': 'Aller à la racine',
    'tooltip.browse': 'Parcourir le dossier nativement',
    'btn.browse': 'Parcourir le dossier',
    'sidebar.folders': 'Dossiers',
    'sidebar.no_subfolders': 'Aucun sous-dossier trouvé',
    'sidebar.collapse': 'Réduire le panneau',
    'sidebar.switch_drive': 'Changer de disque',
    'sidebar.expand_folders': 'Déplier le panneau des dossiers',
    'sidebar.expand_details': 'Déplier le panneau de détails',
    'gallery.title': 'Galerie',
    'gallery.images': 'images',
    'gallery.empty': 'Aucun dossier ouvert',
    'gallery.empty_sub': 'Veuillez sélectionner un dossier pour commencer à numériser et cataloguer vos images.',
    'gallery.scanning': 'Numérisation du dossier et indexation des images...',
    'gallery.no_images': 'Aucune image prise en charge dans ce dossier.',
    'gallery.search': 'Rechercher des images par nom...',
    'gallery.no_match': 'Aucune image ne correspond à votre recherche "{query}"',
    'details.title': 'Image sélectionnée',
    'details.path': 'Chemin du fichier',
    'details.size': 'Taille du fichier',
    'details.dimensions': 'Dimensions',
    'details.keywords': 'Mots-clés',
    'details.no_keywords': 'Aucun mot-clé ajouté pour le moment.',
    'details.add_tag_placeholder': 'Ajouter une étiquette...',
    'details.exif_model': 'Modèle',
    'details.exif_date': 'Date et heure',
    'details.exif_exposure': 'Temps d\'exposition',
    'details.exif_iso': 'Sensibilité ISO',
    'details.exif_aperture': 'Ouverture',
    'details.exif_focal': 'Distance focale',
    'details.ai_generate': 'Générer des étiquettes IA',
    'details.ai_suggested': 'Mots-clés IA suggérés',
    'details.btn_save': 'Enregistrer',
    'details.btn_apply': 'Appliquer les étiquettes',
    'details.tooltip_apply': 'Cliquez pour écrire ces mots-clés dans les métadonnées de l\'image',
    'details.empty': 'Aucune image sélectionnée',
    'details.empty_sub': 'Sélectionnez une image dans la galerie pour afficher ses métadonnées, ses détails EXIF et lancer l\'étiquetage IA.',
    'modal.config_title': 'Options d\'étiquetage par lot',
    'modal.config_mode': 'Mode d\'étiquetage',
    'modal.config_mode_skip': 'Ignorer les images déjà étiquetées',
    'modal.config_mode_append': 'Ajouter les nouvelles étiquettes aux existantes',
    'modal.config_mode_overwrite': 'Remplacer toutes les étiquettes existantes',
    'modal.config_max_tags': 'Nombre max d\'étiquettes par image',
    'modal.config_depth': 'Profondeur de numérisation',
    'modal.config_depth_current': 'Dossier actuel uniquement',
    'modal.config_depth_recursive': 'Récursif (jusqu\'à la profondeur {depth})',
    'modal.config_start': 'Démarrer l\'étiquetage',
    'modal.config_close': 'Fermer',
    'modal.report_title': 'Rapport d\'étiquetage par lot',
    'modal.report_status': 'Statut',
    'modal.report_total': 'Total des images',
    'modal.report_processed': 'Traitées',
    'modal.report_success': 'Succès',
    'modal.report_failures': 'Échecs',
    'modal.report_added': 'Étiquettes ajoutées',
    'modal.report_removed': 'Étiquettes supprimées',
    'modal.report_duration': 'Durée',
    'modal.report_errors': 'Erreurs rencontrées',
    'modal.report_done': 'Terminé'
  }
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly currentLang = signal<Lang>('en');

  constructor() {
    // Try to auto-detect system language
    try {
      const sysLang = navigator.language.split('-')[0].toLowerCase();
      if (sysLang === 'es' || sysLang === 'fr') {
        this.currentLang.set(sysLang as Lang);
      }
    } catch {
      // Ignore errors and keep 'en'
    }
  }

  setLanguage(lang: Lang): void {
    this.currentLang.set(lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.currentLang();
    let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en']?.[key] || key;
    
    if (params) {
      Object.keys(params).forEach(k => {
        text = text.replace(`{${k}}`, String(params[k]));
      });
    }
    
    return text;
  }
}
