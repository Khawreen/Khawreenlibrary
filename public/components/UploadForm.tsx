import React, { useState, useRef } from 'react';
import FileInput from './FileInput';

declare var pdfjsLib: any;

interface UploadFormProps {
  onUpload: (title: string, author: string, language: string, coverFile: File, pdfFile: File, isForSale: boolean, price: number) => Promise<void>;
  showToast: (message: string, type: 'success' | 'error') => void;
}

interface CoverOption {
  id: string;
  title: string;
  subtitle: string;
  file: File;
  previewUrl: string;
  theme?: string;
  isAi?: boolean;
}

type CoverTheme = 'royal_gold' | 'emerald_silk' | 'ruby_velvet' | 'onyx_luxury' | 'turquoise_dome';

const UploadForm: React.FC<UploadFormProps> = ({ onUpload, showToast }) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [language, setLanguage] = useState('English');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [availableCovers, setAvailableCovers] = useState<CoverOption[]>([]);
  const [selectedCoverId, setSelectedCoverId] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isForSale, setIsForSale] = useState(false);
  const [price, setPrice] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isScanningPdf, setIsScanningPdf] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  // Helper to ensure PDF.js is loaded
  const ensurePdfJsLoaded = async () => {
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        if (typeof pdfjsLib !== 'undefined') {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF processing library'));
      document.head.appendChild(script);
    });
  };

  // Helper to generate luxurious, artistic book covers on canvas
  const generateCanvasCover = async (
    bookTitle: string, 
    bookAuthor: string, 
    bookLang: string, 
    theme: CoverTheme = 'royal_gold'
  ): Promise<File> => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1300;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Theme color palettes & textures
    interface ThemeConfig {
      bgGrad: [string, string, string, string];
      primaryGold: string;
      secondaryGold: string;
      lightGold: string;
      cardBg: string;
      cardBorder: string;
      titleColor: string;
      accentJewel: string;
      themeName: string;
    }

    const configs: Record<CoverTheme, ThemeConfig> = {
      royal_gold: {
        bgGrad: ['#040a17', '#0a1a36', '#061329', '#02050d'],
        primaryGold: '#f59e0b',
        secondaryGold: '#d97706',
        lightGold: '#fef08a',
        cardBg: 'rgba(5, 14, 33, 0.92)',
        cardBorder: '#fbbf24',
        titleColor: '#ffffff',
        accentJewel: '#38bdf8',
        themeName: 'Royal Gold Illumination'
      },
      emerald_silk: {
        bgGrad: ['#012319', '#044432', '#02291d', '#01150f'],
        primaryGold: '#eab308',
        secondaryGold: '#ca8a04',
        lightGold: '#fef9c3',
        cardBg: 'rgba(2, 38, 28, 0.92)',
        cardBorder: '#34d399',
        titleColor: '#ffffff',
        accentJewel: '#6ee7b7',
        themeName: 'Emerald Velvet'
      },
      ruby_velvet: {
        bgGrad: ['#28020b', '#4c0516', '#220108', '#140004'],
        primaryGold: '#fbbf24',
        secondaryGold: '#d97706',
        lightGold: '#ffedd5',
        cardBg: 'rgba(40, 4, 13, 0.92)',
        cardBorder: '#f43f5e',
        titleColor: '#ffffff',
        accentJewel: '#fda4af',
        themeName: 'Imperial Crimson Ruby'
      },
      onyx_luxury: {
        bgGrad: ['#090a0f', '#141724', '#0c0d14', '#040507'],
        primaryGold: '#f59e0b',
        secondaryGold: '#b45309',
        lightGold: '#fef08a',
        cardBg: 'rgba(12, 14, 20, 0.94)',
        cardBorder: '#e2e8f0',
        titleColor: '#ffffff',
        accentJewel: '#fbbf24',
        themeName: 'Noir Onyx Marble'
      },
      turquoise_dome: {
        bgGrad: ['#042531', '#0b4a60', '#063445', '#02161e'],
        primaryGold: '#fbbf24',
        secondaryGold: '#d97706',
        lightGold: '#fef08a',
        cardBg: 'rgba(4, 37, 49, 0.92)',
        cardBorder: '#22d3ee',
        titleColor: '#ffffff',
        accentJewel: '#67e8f9',
        themeName: 'Persian Turquoise Mosaic'
      }
    };

    const cfg = configs[theme] || configs.royal_gold;

    // Helper: Create 24K Gold Metallic Gradient
    const createGoldGrad = (x1: number, y1: number, x2: number, y2: number) => {
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(0.2, '#f59e0b');
      g.addColorStop(0.45, '#d97706');
      g.addColorStop(0.7, '#fbbf24');
      g.addColorStop(0.88, '#b45309');
      g.addColorStop(1, '#fef9c3');
      return g;
    };

    // 1. Deep Rich Background Gradient with Radial Ambient Light
    const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGrad.addColorStop(0, cfg.bgGrad[0]);
    bgGrad.addColorStop(0.35, cfg.bgGrad[1]);
    bgGrad.addColorStop(0.7, cfg.bgGrad[2]);
    bgGrad.addColorStop(1, cfg.bgGrad[3]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Radial center glow
    const radialGlow = ctx.createRadialGradient(
      canvas.width / 2, canvas.height * 0.45, 80,
      canvas.width / 2, canvas.height * 0.45, 550
    );
    radialGlow.addColorStop(0, 'rgba(251, 191, 36, 0.15)');
    radialGlow.addColorStop(0.5, 'rgba(245, 158, 11, 0.05)');
    radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scattered gold dust particles
    ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
    for (let i = 0; i < 45; i++) {
      const px = (Math.sin(i * 99 + 17) * 0.5 + 0.5) * (canvas.width - 100) + 50;
      const py = (Math.cos(i * 53 + 31) * 0.5 + 0.5) * (canvas.height - 100) + 50;
      const pr = (i % 3 === 0) ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Outer 24K Gold Triple Border Frame
    const margin = 40;
    const goldGrad1 = createGoldGrad(margin, margin, canvas.width - margin, canvas.height - margin);

    // Outer thick gold line
    ctx.strokeStyle = goldGrad1;
    ctx.lineWidth = 6;
    ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

    // Fine inner filigree line
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(margin + 12, margin + 12, canvas.width - (margin + 12) * 2, canvas.height - (margin + 12) * 2);

    // Dotted gold lace border
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(margin + 20, margin + 20, canvas.width - (margin + 20) * 2, canvas.height - (margin + 20) * 2);
    ctx.setLineDash([]);

    // 3. Ornate Corner Arabesques
    const drawArabesqueCorner = (cx: number, cy: number, flipX: number, flipY: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(flipX, flipY);

      // Gold corner triangles
      ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(110, 0);
      ctx.quadraticCurveTo(70, 70, 0, 110);
      ctx.closePath();
      ctx.fill();

      // Corner arcs
      ctx.strokeStyle = createGoldGrad(0, 0, 100, 100);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 100, 0, Math.PI / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI / 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI / 2);
      ctx.stroke();

      // 8-point gold corner star
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      const starR = 10;
      for (let s = 0; s < 8; s++) {
        const rad = (s * Math.PI) / 4;
        const r = (s % 2 === 0) ? starR : starR * 0.45;
        const sx = 35 + Math.cos(rad) * r;
        const sy = 35 + Math.sin(rad) * r;
        if (s === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    const cOffset = margin + 20;
    drawArabesqueCorner(cOffset, cOffset, 1, 1);
    drawArabesqueCorner(canvas.width - cOffset, cOffset, -1, 1);
    drawArabesqueCorner(cOffset, canvas.height - cOffset, 1, -1);
    drawArabesqueCorner(canvas.width - cOffset, canvas.height - cOffset, -1, -1);

    const fontFamily = "'Helvetica', 'Arial', sans-serif";

    // 4. Top Header & Library Badge
    const archTopY = 95;
    
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 24px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fillText('KHAWREEN DIGITAL LIBRARY', canvas.width / 2, archTopY);

    // Decorative Floral Divider Under Header
    ctx.strokeStyle = createGoldGrad(canvas.width / 2 - 160, 0, canvas.width / 2 + 160, 0);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 160, archTopY + 20);
    ctx.lineTo(canvas.width / 2 - 30, archTopY + 20);
    ctx.moveTo(canvas.width / 2 + 30, archTopY + 20);
    ctx.lineTo(canvas.width / 2 + 160, archTopY + 20);
    ctx.stroke();

    // Center Gold Diamond
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, archTopY + 12);
    ctx.lineTo(canvas.width / 2 + 12, archTopY + 20);
    ctx.lineTo(canvas.width / 2, archTopY + 28);
    ctx.lineTo(canvas.width / 2 - 12, archTopY + 20);
    ctx.closePath();
    ctx.fill();

    // Digital Library Name in Golden Ribbon
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 24px ${fontFamily}`;
    ctx.fillText('AUTHENTIC EDITION', canvas.width / 2, archTopY + 65);

    ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
    ctx.font = 'bold 13px sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('• KHAWREEN DIGITAL LIBRARY •', canvas.width / 2, archTopY + 90);

    // 5. Central Grand Rosette Medallion
    const medallionY = 320;
    const medR = 95;

    // Outer ray petals
    ctx.save();
    ctx.translate(canvas.width / 2, medallionY);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
    ctx.strokeStyle = createGoldGrad(-medR, -medR, medR, medR);
    ctx.lineWidth = 2;

    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath();
      ctx.moveTo(0, -medR - 18);
      ctx.lineTo(12, -medR + 10);
      ctx.lineTo(-12, -medR + 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Central circular plaque
    ctx.fillStyle = 'rgba(10, 15, 28, 0.9)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, medallionY, medR - 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = createGoldGrad(canvas.width / 2 - medR, medallionY - medR, canvas.width / 2 + medR, medallionY + medR);
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner thin ring
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, medallionY, medR - 18, 0, Math.PI * 2);
    ctx.stroke();

    // Emblem Icon
    ctx.fillStyle = '#fef08a';
    ctx.font = '52px Arial';
    ctx.fillText('📖', canvas.width / 2, medallionY + 18);

    // 6. Magnificent Masterpiece Title Cartouche
    const cartoucheY = 460;
    const cartoucheH = 630;
    const cartoucheW = canvas.width - 130;
    const cartoucheX = 65;

    // Cartouche shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 25;
    ctx.shadowOffsetY = 10;

    // Cartouche Background
    ctx.fillStyle = cfg.cardBg;
    ctx.beginPath();
    const cr = 24;
    ctx.roundRect(cartoucheX, cartoucheY, cartoucheW, cartoucheH, cr);
    ctx.fill();

    // Cartouche Gold Beveled Border
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = createGoldGrad(cartoucheX, cartoucheY, cartoucheX + cartoucheW, cartoucheY + cartoucheH);
    ctx.lineWidth = 4;
    ctx.stroke();

    // Inner fine line
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cartoucheX + 12, cartoucheY + 12, cartoucheW - 24, cartoucheH - 24, cr - 8);
    ctx.stroke();

    // A. Title Section
    ctx.textAlign = 'center';
    
    // Title Header Badge
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 22px ${fontFamily}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText('❖ BOOK TITLE ❖', canvas.width / 2, cartoucheY + 65);

    // Book Title text
    ctx.fillStyle = cfg.titleColor;
    ctx.font = `bold 38px ${fontFamily}`;
    ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
    ctx.shadowBlur = 18;

    const words = (bookTitle || 'Book Title').split(' ');
    let line1 = '';
    let line2 = '';
    for (const w of words) {
      if ((line1 + ' ' + w).length < 24) {
        line1 += (line1 ? ' ' : '') + w;
      } else {
        line2 += (line2 ? ' ' : '') + w;
      }
    }

    const titleBracket1 = `« ${line1}${line2 ? '' : ' »'}`;
    ctx.fillText(titleBracket1, canvas.width / 2, cartoucheY + 135);
    
    let titleOffset = 0;
    if (line2) {
      ctx.fillText(`${line2} »`, canvas.width / 2, cartoucheY + 195);
      titleOffset = 60;
    }

    // Gilded Floral Divider 1
    ctx.strokeStyle = createGoldGrad(cartoucheX + 60, 0, cartoucheX + cartoucheW - 60, 0);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cartoucheX + 80, cartoucheY + 200 + titleOffset);
    ctx.lineTo(cartoucheX + cartoucheW - 80, cartoucheY + 200 + titleOffset);
    ctx.stroke();

    // B. Author Section
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold 22px ${fontFamily}`;
    ctx.fillText('✍️ AUTHOR', canvas.width / 2, cartoucheY + 250 + titleOffset);

    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 32px ${fontFamily}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fillText(bookAuthor || 'Author Name', canvas.width / 2, cartoucheY + 305 + titleOffset);

    // Gilded Floral Divider 2
    ctx.strokeStyle = createGoldGrad(cartoucheX + 60, 0, cartoucheX + cartoucheW - 60, 0);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cartoucheX + 80, cartoucheY + 355 + titleOffset);
    ctx.lineTo(cartoucheX + cartoucheW - 80, cartoucheY + 355 + titleOffset);
    ctx.stroke();

    // C. Language Badge Pill
    const pillW = 260;
    const pillH = 50;
    const pillX = canvas.width / 2 - pillW / 2;
    const pillY = cartoucheY + 400 + titleOffset;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 25);
    ctx.fill();

    ctx.strokeStyle = createGoldGrad(pillX, pillY, pillX + pillW, pillY + pillH);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = cfg.accentJewel;
    ctx.font = `bold 22px ${fontFamily}`;
    ctx.fillText(`🌐 Language: ${bookLang || 'English'}`, canvas.width / 2, pillY + 34);

    // 7. Bottom Royal Seal
    const sealY = canvas.height - 130;
    ctx.fillStyle = '#fbbf24';
    ctx.font = `16px ${fontFamily}`;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText('✦ KHAWREEN DIGITAL LIBRARY ARTISTIC EDITION ✦', canvas.width / 2, sealY);

    ctx.fillStyle = 'rgba(254, 240, 138, 0.6)';
    ctx.font = '12px sans-serif';
    ctx.fillText('KHAWREEN ARCHIVES • AUTHENTIC DIGITAL EDITION', canvas.width / 2, sealY + 25);

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.96));
    if (!blob) throw new Error('Failed to create canvas image');
    const safeTitle = (bookTitle || 'book').replace(/\s+/g, '_');
    return new File([blob], `${safeTitle}_${theme}_cover.jpg`, { type: 'image/jpeg' });
  };

  // Helper to build 5 magnificent themed covers based on current Title/Author/Lang
  const buildThemedCovers = async (t: string, a: string, l: string): Promise<CoverOption[]> => {
    const currentTitle = t || 'Book Title';
    const currentAuthor = a || 'Author Name';
    const currentLang = l || 'English';

    const themes: { id: CoverTheme; title: string; subtitle: string }[] = [
      { id: 'royal_gold', title: 'Royal Gold Illumination', subtitle: 'Royal Lapis & 24K Gold Illumination' },
      { id: 'emerald_silk', title: 'Emerald Velvet', subtitle: 'Emerald Velvet & Gold Filigree' },
      { id: 'ruby_velvet', title: 'Imperial Crimson Ruby', subtitle: 'Imperial Crimson Ruby & Gold' },
      { id: 'onyx_luxury', title: 'Noir Onyx Marble', subtitle: 'Noir Onyx Marble & Rose Gold' },
      { id: 'turquoise_dome', title: 'Persian Turquoise Mosaic', subtitle: 'Persian Turquoise & Gold Mosaic' },
    ];

    const generated: CoverOption[] = [];
    for (const item of themes) {
      try {
        const file = await generateCanvasCover(currentTitle, currentAuthor, currentLang, item.id);
        generated.push({
          id: `theme_${item.id}`,
          title: item.title,
          subtitle: item.subtitle,
          file,
          previewUrl: URL.createObjectURL(file),
          theme: item.id
        });
      } catch (err) {
        console.warn(`Failed to generate ${item.id} cover:`, err);
      }
    }
    return generated;
  };

  // Select a specific cover from the gallery
  const selectCover = (option: CoverOption) => {
    setSelectedCoverId(option.id);
    setCoverFile(option.file);
    showToast(`✨ Cover selected: ${option.title}`, 'success');
  };

  // Manual Cover Image Upload Handler
  const handleCustomCoverUpload = (file: File | null) => {
    if (!file) return;
    const customId = `custom_${Date.now()}`;
    const customOption: CoverOption = {
      id: customId,
      title: 'Custom Uploaded Cover',
      subtitle: file.name,
      file,
      previewUrl: URL.createObjectURL(file),
    };
    setAvailableCovers(prev => [customOption, ...prev.filter(c => !c.id.startsWith('custom_'))]);
    setSelectedCoverId(customId);
    setCoverFile(file);
    showToast('✨ Custom cover selected successfully!', 'success');
  };

  // Automated PDF Scan & Cover Extraction
  const handlePdfChange = async (file: File | null) => {
    setPdfFile(file);
    if (!file) return;

    // Instant smart prefill based on filename
    const cleanFileName = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
    let initialTitle = title || cleanFileName;
    let initialAuthor = author;
    let initialLang = language || 'English';

    if (!title) setTitle(cleanFileName);

    setIsScanningPdf(true);
    setScanStatusMessage('Reading PDF & Extracting Covers...');
    showToast('🔍 Analyzing PDF document...', 'success');

    const newCoverOptions: CoverOption[] = [];

    try {
      await ensurePdfJsLoaded();
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      let coverImageBase64: string | null = null;
      let titlePageBase64: string | null = null;

      // 1. Extract Page 1 (Original PDF Cover)
      try {
        setScanStatusMessage('Extracting Page 1 (Original Cover)...');
        const firstPage = await pdf.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await firstPage.render({ canvasContext: ctx, viewport }).promise;
          coverImageBase64 = canvas.toDataURL('image/jpeg', 0.9);
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          if (blob) {
            const p1File = new File([blob], `${file.name.replace(/\.pdf$/i, '')}_page1.jpg`, { type: 'image/jpeg' });
            newCoverOptions.push({
              id: 'pdf_page_1',
              title: 'PDF Page 1 (Original Cover)',
              subtitle: 'Original Scanned Cover',
              file: p1File,
              previewUrl: URL.createObjectURL(p1File)
            });
          }
        }
      } catch (coverErr) {
        console.warn('First page extraction warning:', coverErr);
      }

      // 2. Extract Page 2 (Title Page / Details)
      if (pdf.numPages >= 2) {
        try {
          setScanStatusMessage('Extracting Page 2 (Details)...');
          const secondPage = await pdf.getPage(2);
          const vp2 = secondPage.getViewport({ scale: 1.3 });
          const c2 = document.createElement('canvas');
          c2.width = vp2.width;
          c2.height = vp2.height;
          const ctx2 = c2.getContext('2d');
          if (ctx2) {
            await secondPage.render({ canvasContext: ctx2, viewport: vp2 }).promise;
            titlePageBase64 = c2.toDataURL('image/jpeg', 0.85);
            const blob2 = await new Promise<Blob | null>(resolve => c2.toBlob(resolve, 'image/jpeg', 0.85));
            if (blob2) {
              const p2File = new File([blob2], `${file.name.replace(/\.pdf$/i, '')}_page2.jpg`, { type: 'image/jpeg' });
              newCoverOptions.push({
                id: 'pdf_page_2',
                title: 'PDF Page 2 (Title Page)',
                subtitle: 'Page 2 Details',
                file: p2File,
                previewUrl: URL.createObjectURL(p2File)
              });
            }
          }
        } catch (p2Err) {
          console.warn('Second page extraction warning:', p2Err);
        }
      }

      // 3. Extract Page 3 if exists
      if (pdf.numPages >= 3) {
        try {
          const thirdPage = await pdf.getPage(3);
          const vp3 = thirdPage.getViewport({ scale: 1.2 });
          const c3 = document.createElement('canvas');
          c3.width = vp3.width;
          c3.height = vp3.height;
          const ctx3 = c3.getContext('2d');
          if (ctx3) {
            await thirdPage.render({ canvasContext: ctx3, viewport: vp3 }).promise;
            const blob3 = await new Promise<Blob | null>(resolve => c3.toBlob(resolve, 'image/jpeg', 0.85));
            if (blob3) {
              const p3File = new File([blob3], `${file.name.replace(/\.pdf$/i, '')}_page3.jpg`, { type: 'image/jpeg' });
              newCoverOptions.push({
                id: 'pdf_page_3',
                title: 'PDF Page 3',
                subtitle: 'Page 3',
                file: p3File,
                previewUrl: URL.createObjectURL(p3File)
              });
            }
          }
        } catch (p3Err) {}
      }

      // 4. Extract Text from First 5 Pages
      setScanStatusMessage('Scanning with Multimodal AI...');
      let fullTextSnippet = '';
      const pagesToScan = Math.min(5, pdf.numPages);
      for (let p = 1; p <= pagesToScan; p++) {
        try {
          const page = await pdf.getPage(p);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullTextSnippet += pageText + '\n';
        } catch (e) {}
      }

      // 5. Call Server AI with Multimodal Vision
      let detectedTitle = initialTitle;
      let detectedAuthor = initialAuthor;
      let detectedLang = initialLang;

      try {
        const scanRes = await fetch('/api/ai/scan-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textSnippet: fullTextSnippet,
            fileName: file.name,
            coverImageBase64,
            titlePageBase64
          })
        });

        if (scanRes.ok) {
          const data = await scanRes.json();
          if (data.title) {
            detectedTitle = data.title;
            setTitle(data.title);
          }
          if (data.author && data.author.trim().length > 0) {
            detectedAuthor = data.author.trim();
            setAuthor(data.author.trim());
          }
          if (data.language && ['Pashto', 'Dari', 'English', 'Other'].includes(data.language)) {
            detectedLang = data.language;
            setLanguage(data.language);
          }
        }
      } catch (scanErr) {
        console.warn('Scan request error:', scanErr);
      }

      // 6. Generate Themed Digital Library Covers
      setScanStatusMessage('Generating Themed Covers...');
      const themedCovers = await buildThemedCovers(detectedTitle, detectedAuthor, detectedLang);
      const combinedOptions = [...newCoverOptions, ...themedCovers];

      setAvailableCovers(combinedOptions);

      // Default selection: Choose Page 1 if available, otherwise choose gold theme
      if (newCoverOptions.length > 0) {
        setSelectedCoverId(newCoverOptions[0].id);
        setCoverFile(newCoverOptions[0].file);
      } else if (themedCovers.length > 0) {
        setSelectedCoverId(themedCovers[0].id);
        setCoverFile(themedCovers[0].file);
      }

      showToast(`✨ Book "${detectedTitle}" and cover options ready!`, 'success');
    } catch (e: any) {
      console.error('PDF scanning failed:', e);
      showToast('An error occurred while reading the PDF.', 'error');
    } finally {
      setIsScanningPdf(false);
      setScanStatusMessage('');
    }
  };

  // Re-generate themed covers when user updates Title or Author manually
  const refreshThemedCovers = async () => {
    if (!title.trim()) {
      alert('Please enter the book title');
      return;
    }
    setIsGeneratingCover(true);
    try {
      const themed = await buildThemedCovers(title, author, language);
      setAvailableCovers(prev => {
        const nonThemed = prev.filter(c => !c.id.startsWith('theme_'));
        return [...nonThemed, ...themed];
      });
      if (themed.length > 0) {
        selectCover(themed[0]);
      }
      showToast('🎨 New cover designs generated based on updated info!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to generate cover designs.', 'error');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Generate AI artistic cover via Gemini/Imagen
  const handleGenerateCover = async () => {
    if (!title.trim() || !author.trim()) {
      alert('Please fill Title and Author first!');
      return;
    }

    setIsGeneratingCover(true);
    showToast('🎨 Generating unique AI artistic cover...', 'success');

    try {
      let aiCoverFile: File | null = null;

      // Try server-side Imagen endpoint
      try {
        const res = await fetch('/api/ai/generate-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, author, language })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.base64Image) {
            const image = new Image();
            const imageLoadPromise = new Promise<void>((resolve, reject) => {
              image.onload = () => resolve();
              image.onerror = reject;
            });
            image.src = `data:image/jpeg;base64,${data.base64Image}`;
            await imageLoadPromise;

            const canvas = document.createElement('canvas');
            canvas.width = 900;
            canvas.height = 1300;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

              // Helper for gold gradient
              const createGoldGrad = (x1: number, y1: number, x2: number, y2: number) => {
                const g = ctx.createLinearGradient(x1, y1, x2, y2);
                g.addColorStop(0, '#fef08a');
                g.addColorStop(0.25, '#f59e0b');
                g.addColorStop(0.5, '#d97706');
                g.addColorStop(0.75, '#fbbf24');
                g.addColorStop(1, '#fef9c3');
                return g;
              };

              // 1. Gilded outer border frame around AI art
              const margin = 28;
              ctx.strokeStyle = createGoldGrad(margin, margin, canvas.width - margin, canvas.height - margin);
              ctx.lineWidth = 5;
              ctx.strokeRect(margin, margin, canvas.width - margin * 2, canvas.height - margin * 2);

              ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(margin + 10, margin + 10, canvas.width - (margin + 10) * 2, canvas.height - (margin + 10) * 2);

              const fontFamily = "'Helvetica', 'Arial', sans-serif";

              // 2. Top Header Ribbon
              ctx.fillStyle = 'rgba(5, 10, 24, 0.85)';
              ctx.beginPath();
              ctx.roundRect(canvas.width / 2 - 180, 50, 360, 48, 24);
              ctx.fill();

              ctx.strokeStyle = createGoldGrad(canvas.width / 2 - 180, 50, canvas.width / 2 + 180, 98);
              ctx.lineWidth = 2;
              ctx.stroke();

              ctx.textAlign = 'center';
              ctx.fillStyle = '#fbbf24';
              ctx.font = `bold 20px ${fontFamily}`;
              ctx.fillText('KHAWREEN DIGITAL LIBRARY', canvas.width / 2, 82);

              // 3. Luxurious Masterpiece Title Plaque at bottom
              const plaqueH = 550;
              const plaqueY = canvas.height - plaqueH - 50;
              const plaqueW = canvas.width - 100;
              const plaqueX = 50;

              // Plaque background with soft dark vignette
              ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
              ctx.shadowBlur = 24;
              ctx.shadowOffsetY = 8;
              ctx.fillStyle = 'rgba(4, 9, 20, 0.9)';
              ctx.beginPath();
              ctx.roundRect(plaqueX, plaqueY, plaqueW, plaqueH, 20);
              ctx.fill();

              // Plaque gold trim
              ctx.shadowColor = 'transparent';
              ctx.strokeStyle = createGoldGrad(plaqueX, plaqueY, plaqueX + plaqueW, plaqueY + plaqueH);
              ctx.lineWidth = 3.5;
              ctx.stroke();

              ctx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.roundRect(plaqueX + 10, plaqueY + 10, plaqueW - 20, plaqueH - 20, 14);
              ctx.stroke();

              ctx.textAlign = 'center';
              ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
              ctx.shadowBlur = 10;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;

              // 1. Book Title
              ctx.fillStyle = '#fbbf24';
              ctx.font = `bold 22px ${fontFamily}`;
              ctx.fillText('BOOK TITLE:', canvas.width / 2, plaqueY + 58);

              ctx.fillStyle = '#ffffff';
              ctx.font = `bold 36px ${fontFamily}`;
              ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
              ctx.shadowBlur = 16;
              ctx.fillText(`« ${title} »`, canvas.width / 2, plaqueY + 115);

              // Divider 1
              ctx.shadowColor = 'transparent';
              ctx.strokeStyle = createGoldGrad(plaqueX + 50, 0, plaqueX + plaqueW - 50, 0);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(plaqueX + 60, plaqueY + 160);
              ctx.lineTo(plaqueX + plaqueW - 60, plaqueY + 160);
              ctx.stroke();

              // 2. Author
              ctx.fillStyle = '#fbbf24';
              ctx.font = `bold 22px ${fontFamily}`;
              ctx.fillText('AUTHOR:', canvas.width / 2, plaqueY + 215);

              ctx.fillStyle = '#f8fafc';
              ctx.font = `bold 32px ${fontFamily}`;
              ctx.fillText(author, canvas.width / 2, plaqueY + 268);

              // Divider 2
              ctx.strokeStyle = createGoldGrad(plaqueX + 50, 0, plaqueX + plaqueW - 50, 0);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(plaqueX + 60, plaqueY + 315);
              ctx.lineTo(plaqueX + plaqueW - 60, plaqueY + 315);
              ctx.stroke();

              // 3. Language
              ctx.fillStyle = '#fbbf24';
              ctx.font = `bold 22px ${fontFamily}`;
              ctx.fillText('LANGUAGE:', canvas.width / 2, plaqueY + 370);

              ctx.fillStyle = '#38bdf8';
              ctx.font = `bold 30px ${fontFamily}`;
              ctx.fillText(language, canvas.width / 2, plaqueY + 420);

              // Seal footer inside plaque
              ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
              ctx.font = `15px ${fontFamily}`;
              ctx.fillText('✦ KHAWREEN DIGITAL LIBRARY AUTHENTIC AI ART COVER ✦', canvas.width / 2, plaqueY + 490);

              const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
              if (blob) {
                const fileName = `${title.replace(/\s+/g, '_')}_ai_art_cover.jpg`;
                aiCoverFile = new File([blob], fileName, { type: 'image/jpeg' });
              }
            }
          }
        }
      } catch (apiErr) {
        console.warn('Server Imagen generation fallback:', apiErr);
      }

      // If Imagen was unavailable, generate golden canvas cover
      if (!aiCoverFile) {
        aiCoverFile = await generateCanvasCover(title, author, language, 'royal_gold');
      }

      const aiId = `ai_cover_${Date.now()}`;
      const aiOption: CoverOption = {
        id: aiId,
        title: 'AI Generated Artistic Cover',
        subtitle: 'Gemini AI Art Cover',
        file: aiCoverFile,
        previewUrl: URL.createObjectURL(aiCoverFile),
        isAi: true
      };

      setAvailableCovers(prev => [aiOption, ...prev.filter(c => !c.isAi)]);
      setSelectedCoverId(aiId);
      setCoverFile(aiCoverFile);
      showToast('✨ AI Artistic cover generated and selected successfully!', 'success');

    } catch (e: any) {
      console.error('AI Cover Generation Error:', e);
      showToast('An error occurred while generating cover.', 'error');
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !author || !language || !coverFile || !pdfFile) {
      alert('All fields are required. Please select a cover and PDF file.');
      return;
    }
    if (isForSale && (!price || Number(price) <= 0)) {
      alert('Please enter a valid price for the book.');
      return;
    }
    setIsUploading(true);
    try {
      await onUpload(title, author, language, coverFile, pdfFile, isForSale, Number(price));
      setTitle('');
      setAuthor('');
      setLanguage('English');
      setCoverFile(null);
      setAvailableCovers([]);
      setSelectedCoverId('');
      setPdfFile(null);
      setIsForSale(false);
      setPrice('');
      if (formRef.current) {
        formRef.current.reset();
      }
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-3">
          <i className="fas fa-upload"></i>
          Share Your Book
        </h2>
        <span className="text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 font-semibold px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
          ✨ Multi-Cover Selection Enabled
        </span>
      </div>

      {isScanningPdf && (
        <div className="mb-5 p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl flex items-center gap-3 shadow-sm animate-pulse">
          <i className="fas fa-magic fa-spin text-indigo-600 dark:text-indigo-400 text-2xl"></i>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              AI Smart Scan & Analysis...
            </h4>
            <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">
              {scanStatusMessage || 'Extracting book title, author, and generating cover options...'}
            </p>
          </div>
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* 1. PDF File Input (First for auto-fill & multi-cover extraction flow!) */}
        <div className="p-4 bg-gradient-to-br from-indigo-50/70 to-sky-50/70 dark:from-slate-800/80 dark:to-slate-800/40 border-2 border-dashed border-indigo-300 dark:border-indigo-700/60 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <i className="fas fa-file-pdf text-red-500 text-lg"></i>
              1. Select Book PDF Document (Auto-Scan & Extract Covers)
            </span>
            {pdfFile && !isScanningPdf && (
              <button
                type="button"
                onClick={() => handlePdfChange(pdfFile)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <i className="fas fa-sync-alt"></i> Rescan PDF
              </button>
            )}
          </div>
          <FileInput
            id="pdf"
            label="Click or drag PDF document here to auto-scan details & multiple cover options"
            iconClass="fa-file-pdf"
            accept="application/pdf"
            file={pdfFile}
            onFileChange={handlePdfChange}
          />
        </div>

        {/* 2. Title, Author, Language Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group flex flex-col gap-2">
            <label htmlFor="title" className="font-semibold text-slate-700 dark:text-slate-300 flex justify-between">
              <span>Book Title</span>
              {title && <span className="text-xs text-emerald-600 font-bold">✓ Filled</span>}
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter book title"
              required
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="form-group flex flex-col gap-2">
            <label htmlFor="author" className="font-semibold text-slate-700 dark:text-slate-300 flex justify-between">
              <span>Author Name</span>
              {author && <span className="text-xs text-emerald-600 font-bold">✓ Filled</span>}
            </label>
            <input
              type="text"
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter author name"
              required
              className="p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
        
        <div className="form-group flex flex-col gap-2">
          <label htmlFor="language" className="font-semibold text-slate-700 dark:text-slate-300">
            Language
          </label>
          <div className="relative">
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              required
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 focus:border-indigo-600 transition bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 appearance-none"
            >
              <option value="English">English</option>
              <option value="Pashto">Pashto</option>
              <option value="Dari">Dari</option>
              <option value="Other">Other</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700 dark:text-slate-400">
              <i className="fas fa-chevron-down h-5 w-5"></i>
            </div>
          </div>
        </div>

        {/* 3. Interactive Cover Selection Studio */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-base">
                <i className="fas fa-images text-indigo-600 dark:text-indigo-400"></i>
                2. Choose Book Cover
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select from original PDF cover, inner pages, artistic themes, or generate with AI in one click:
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={refreshThemedCovers}
                disabled={isGeneratingCover || !title.trim()}
                className="text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Regenerate themed covers based on current title and author"
              >
                <i className="fas fa-palette text-amber-500"></i>
                New Designs
              </button>

              <button
                type="button"
                onClick={handleGenerateCover}
                disabled={isGeneratingCover || !title.trim()}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isGeneratingCover ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Generating Cover...
                  </>
                ) : (
                  <>
                    <i className="fas fa-wand-magic-sparkles text-amber-300"></i>
                    AI Art Cover
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Cover Gallery Grid */}
          {availableCovers.length > 0 ? (
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2.5 block">
                Available Covers (Click to select):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {availableCovers.map((opt) => {
                  const isSelected = selectedCoverId === opt.id || coverFile === opt.file;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => selectCover(opt)}
                      className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 flex flex-col bg-white dark:bg-slate-900 shadow-sm ${
                        isSelected
                          ? 'border-emerald-500 ring-3 ring-emerald-400/30 scale-[1.02] shadow-md'
                          : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow'
                      }`}
                    >
                      {/* Selection Badge */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-fade-in">
                          <i className="fas fa-check"></i> Selected
                        </div>
                      )}

                      {/* Image Preview Thumbnail */}
                      <div className="aspect-3/4 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center relative">
                        <img
                          src={opt.previewUrl}
                          alt={opt.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 text-xs font-bold px-2.5 py-1 rounded-md shadow">
                            Select
                          </span>
                        </div>
                      </div>

                      {/* Card Label */}
                      <div className="p-2 text-center bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                        <div className="font-bold text-xs text-slate-800 dark:text-slate-200 line-clamp-1">
                          {opt.title}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {opt.subtitle}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 px-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <i className="fas fa-image text-slate-400 text-3xl mb-2"></i>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No PDF selected yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                When you upload a PDF, original scanned covers and artistic designs will appear here for you to choose.
              </p>
            </div>
          )}

          {/* Manual / Custom File Upload Option */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80">
            <label className="font-semibold text-xs text-slate-700 dark:text-slate-300 block mb-1.5">
              Or upload a custom cover image from your device:
            </label>
            <FileInput 
              id="cover"
              label="Click to upload custom cover image (JPEG, PNG, WebP)"
              iconClass="fa-file-image"
              accept="image/jpeg, image/png, image/webp, image/gif"
              file={coverFile}
              onFileChange={handleCustomCoverUpload}
            />
          </div>
        </div>
        
        {/* 4. Sale Options */}
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isForSale"
              checked={isForSale}
              onChange={(e) => setIsForSale(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-200 dark:bg-slate-600 cursor-pointer"
            />
            <label htmlFor="isForSale" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              This book is for sale
            </label>
          </div>
          {isForSale && (
            <div className="mt-4 animate-fade-in">
              <label htmlFor="price" className="font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Price in AFN
              </label>
              <input
                type="number"
                id="price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g., 500"
                min="0"
                step="1"
                required
                className="p-3 w-full border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>
          )}
        </div>

        {/* 5. Submit Button */}
        <button
          type="submit"
          disabled={isUploading || isScanningPdf || !coverFile}
          className="bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-emerald-600 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2 mt-2 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed text-base cursor-pointer"
        >
          {isUploading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              Uploading...
            </>
          ) : (
            <>
              <i className="fas fa-upload"></i>
              Upload Book
            </>
          )}
        </button>
      </form>
    </>
  );
};

export default UploadForm;
