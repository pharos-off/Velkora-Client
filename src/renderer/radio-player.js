class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.volume = 0.5;
    this.modal = null;
    this.currentPlaylistName = null;
    this.currentIndex = 0;
    this.isPlaying = false; // ✅ Flag pour tracker l'état de lecture
    this.loadPromise = null; // ✅ Promise pour gérer les chargements
    this.assetsPath = null; // ✅ Sera chargé via IPC

    this.playerIcons = {
      chill: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14c2-4 6-6 10-4s6 6 2 8"/><path d="M4 10c2 2 6 2 10 0"/></svg>',
      lofi: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 9v6h6"/><path d="M16 7h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><path d="M8 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/></svg>',
      gaming: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z"/><path d="M16 12h-4"/><path d="M14 10v4"/></svg>',
      focus: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v3"/><path d="M12 20v3"/><path d="M4.22 4.22l2.12 2.12"/><path d="M17.66 17.66l2.12 2.12"/><path d="M1 12h3"/><path d="M20 12h3"/></svg>',
      phonk: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M5 12h14"/></svg>',
      soon: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'
    };
    
    // ✅ Charger le chemin des assets via IPC
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('get-assets-path').then(path => {
      this.assetsPath = path;
      console.log('✅ Assets path loaded:', this.assetsPath);
    }).catch(err => {
      console.error('Erreur chargement assets path:', err);
    });

    // ✅ Sauvegarder le temps actuel toutes les secondes
    setInterval(() => {
      if (this.currentPlaylistName && !this.audio.paused) {
        localStorage.setItem('currentRadioTime', this.audio.currentTime.toString());
      }
    }, 1000);

    this.playlists = {
      chill: {
        icon: this.playerIcons.chill,
        name: 'Good Vibes',
        desc: 'Relaxing and mellow tunes',
        badge: 'Free',
        color: '#6366f1',
        tracks: [
          { title: 'Good Vibes Chill House Music', duration: '1:10:34' },
        ],
        files: [
          'chill/chill.mp3',
        ]
      },
      lofi: {
        icon: this.playerIcons.lofi,
        name: 'Lofi Hip Hop',
        desc: 'Study and relax beats',
        badge: 'Free',
        color: '#8b5cf6',
        tracks: [
          { title: '5H Lofi Chill Beats to Relax, Study, Work & Sleep | Long Gil Lofi [No Ads]', duration: '5:02:17' }
        ],
        files: [
          'lofi/lofi.mp3',
        ]
      },
      gaming: {
        icon: this.playerIcons.gaming,
        name: 'Gaming Hype',
        desc: 'Hard drops. Heavy bass.',
        badge: 'Premium',
        color: '#ec4899',
        tracks: [
          { title: 'Cool Gaming Music 2024 Best Music Mix, NCS, Electronic, House Best Of EDM 2024', duration: '2:00:35' }
        ],
        files: [
          'gaming/gaming.mp3'
        ]
      },
      focus: {
        icon: this.playerIcons.focus,
        name: 'Deep Focus',
        desc: 'Concentration and productivity',
        badge: 'Free',
        color: '#06b6d4',
        tracks: [
          { title: 'Deep Focus - Music For Studying, Concentration and Work', duration: '3:52:17' }
        ],
        files: [
          'focus/focus.mp3'
        ]
      },
      phonk: {
        icon: this.playerIcons.phonk,
        name: 'Phonk Beats',
        desc: 'Retro vibes and smooth rhythms',
        badge: 'Premium',
        color: '#f59e0b',
        tracks: [
          { title: 'AURA = 1 HOUR VIRAL AURA MUSIC PLAYLIST 2026 TRENDING PHONK HITS', duration: '1:10:14' },
          { title: 'Phonk Music Mix 2025 ※ 1 HOUR AGGRESSIVE PHONK PLAYLIST ※ Фонка 2025', duration: '1:47:36' }
        ],
        files: [
          'phonk/phonk.mp3',
          'phonk/phonk2.mp3'
        ]
      },

      invalide: {
        icon: this.playerIcons.soon,
        name: 'Coming Soon',
        desc: 'This playlist is not yet available',
        badge: 'Soon',
        color: '#000000',
        tracks: [
          //{ title: '', duration: '' }
        ],
        files: [
          //'./assets/music/focus/focus.mp3'
        ]
      },
      invalide2: {
        icon: this.playerIcons.soon,
        name: 'Coming Soon',
        desc: 'This playlist is not yet available',
        badge: 'Soon',
        color: '#000000',
        tracks: [
          //{ title: '', duration: '' }
        ],
        files: [
          //'./assets/music/focus/focus.mp3'
        ]
      },
      invalide3: {
        icon: this.playerIcons.soon,
        name: 'Coming Soon',
        desc: 'This playlist is not yet available',
        badge: 'Soon',
        color: '#000000',
        tracks: [
          //{ title: '', duration: '' }
        ],
        files: [
          //'./assets/music/focus/focus.mp3'
        ]
      },
      invalide4: {
        icon: this.playerIcons.soon,
        name: 'Coming Soon',
        desc: 'This playlist is not yet available',
        badge: 'Soon',
        color: '#000000',
        tracks: [
          //{ title: '', duration: '' }
        ],
        files: [
          //'./assets/music/focus/focus.mp3'
        ]
      }
    };

    this.audio.addEventListener('ended', () => {
      this.next();
    });
  }

  open() {
    // Restaurer l'état si une playlist était active
    const savedPlaylist = localStorage.getItem('currentRadioPlaylist');
    const savedIndex = parseInt(localStorage.getItem('currentRadioIndex') || '0');
    const savedTime = parseFloat(localStorage.getItem('currentRadioTime') || '0');
    
    // Vérifier si le modal existe déjà
    const existingModal = document.getElementById('radio-modal');
    if (existingModal) existingModal.remove();

    // Créer le modal principal
    this.modal = document.createElement('div');
    this.modal.id = 'radio-modal';
    this.modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(8px);';

    const content = document.createElement('div');
    content.style.cssText = 'background: rgba(15, 23, 42, 0.99); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 24px; max-width: 900px; width: 90%; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column; box-sizing: border-box; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6);';

    const innerContent = document.createElement('div');
    innerContent.style.cssText = 'padding: 40px; display: flex; flex-direction: column; overflow-y: auto;';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid rgba(99, 102, 241, 0.2);';
    
    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = `
      <h1 style="margin: 0; color: #e2e8f0; font-size: 32px; font-weight: 700;">Music Player</h1>
      <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">Selectionne une playlist et joue ta musique préférée</p>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = 'background: #ef4444; border: none; color: white; font-size: 28px; cursor: pointer; padding: 4px 10px; border-radius: 4px; transition: all 0.2s; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-weight: bold;';
    closeBtn.onmouseover = () => closeBtn.style.background = '#dc2626';
    closeBtn.onmouseout = () => closeBtn.style.background = '#ef4444';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(titleDiv);
    header.appendChild(closeBtn);

    // Player section
    const playerSection = document.createElement('div');
    playerSection.id = 'music-player-section';
    playerSection.style.cssText = 'background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px; padding: 25px; margin-bottom: 30px; display: none;';
    
    const nowPlayingDiv = document.createElement('div');
    nowPlayingDiv.id = 'music-now-playing';
    nowPlayingDiv.style.cssText = 'text-align: center; margin-bottom: 20px; min-height: 70px;';
    nowPlayingDiv.innerHTML = '<div style="font-size: 18px; color: #94a3b8;">Sélectionne une playlist</div>';

    const playerControls = document.createElement('div');
    playerControls.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-bottom: 20px;';

    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'music-pause-btn';
    pauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play';
    pauseBtn.style.cssText = 'padding: 10px 20px; background: #8b5cf6; border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 8px;';
    pauseBtn.onmouseover = () => pauseBtn.style.background = '#a78bfa';
    pauseBtn.onmouseout = () => pauseBtn.style.background = '#8b5cf6';
    pauseBtn.addEventListener('click', () => {
      if (this.audio.paused) {
        this.resume();
        pauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
      } else {
        this.pause();
        pauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play';
      }
    });

    const stopBtn = document.createElement('button');
    stopBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16"/></svg> Stop';
    stopBtn.style.cssText = 'padding: 10px 20px; background: #ef4444; border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; gap: 8px;';
    stopBtn.onmouseover = () => stopBtn.style.background = '#f87171';
    stopBtn.onmouseout = () => stopBtn.style.background = '#ef4444';
    stopBtn.addEventListener('click', () => this.stop());

    const nextBtn = document.createElement('button');
    nextBtn.id = 'music-next-btn';
    nextBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="17" y="4" width="2" height="16"/></svg> Next';
    nextBtn.style.cssText = 'padding: 10px 20px; background: #06b6d4; border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer; transition: all 0.3s; display: none; align-items: center; gap: 8px;';
    nextBtn.onmouseover = () => nextBtn.style.background = '#22d3ee';
    nextBtn.onmouseout = () => nextBtn.style.background = '#06b6d4';
    nextBtn.addEventListener('click', () => this.next());

    playerControls.appendChild(pauseBtn);
    playerControls.appendChild(stopBtn);
    playerControls.appendChild(nextBtn);

    // Volume control
    const volumeDiv = document.createElement('div');
    volumeDiv.style.cssText = 'display: flex; gap: 12px; align-items: center; justify-content: center; margin-top: 15px;';
    
    const volumeLabel = document.createElement('span');
    volumeLabel.style.cssText = 'color: #94a3b8; font-size: 12px; width: 30px;';
    volumeLabel.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a7 7 0 0 1 0 9.9M17.5 4.46a11 11 0 0 1 0 15.07"></path></svg>`;
    
    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = '50';
    volumeSlider.style.cssText = 'flex: 1; max-width: 150px; height: 4px; cursor: pointer;';
    volumeSlider.addEventListener('input', (e) => {
      this.audio.volume = e.target.value / 100;
    });
    
    const volumePercent = document.createElement('span');
    volumePercent.style.cssText = 'color: #94a3b8; font-size: 12px; width: 35px; text-align: right;';
    volumePercent.textContent = '50%';
    
    volumeSlider.addEventListener('input', (e) => {
      volumePercent.textContent = e.target.value + '%';
      this.audio.volume = e.target.value / 100;
    });
    
    volumeDiv.appendChild(volumeLabel);
    volumeDiv.appendChild(volumeSlider);
    volumeDiv.appendChild(volumePercent);

    const progressDiv = document.createElement('div');
    progressDiv.style.cssText = 'display: flex; gap: 10px; align-items: center; font-size: 12px; color: #94a3b8;';
    progressDiv.innerHTML = `
      <span id="music-current-time">0:00</span>
      <input id="music-progress" type="range" min="0" max="100" value="0" style="flex: 1; height: 4px; cursor: pointer;">
      <span id="music-duration">0:00</span>
    `;

    const infoDiv = document.createElement('div');
    infoDiv.id = 'music-track-info';
    infoDiv.style.cssText = 'text-align: center; font-size: 13px; color: #cbd5e1; margin-top: 15px;';
    infoDiv.textContent = 'Pas de chanson en lecture';

    playerSection.appendChild(nowPlayingDiv);
    playerSection.appendChild(playerControls);
    playerSection.appendChild(volumeDiv);
    playerSection.appendChild(progressDiv);
    playerSection.appendChild(infoDiv);

    // Playlist selector
    const playlistContainer = document.createElement('div');
    playlistContainer.id = 'music-playlists';
    playlistContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;';

    // Footer
    const footer = document.createElement('div');
    footer.style.cssText = 'text-align: center; margin-top: 40px; padding-top: 25px; border-top: 1px solid rgba(99, 102, 241, 0.15); font-size: 13px; color: #64748b;';
    footer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b; line-height: 1.6; gap: 20px;">
        <div style="flex: 1; text-align: left;">
          Powered by <span style="color: #6366f1; font-weight: 700;">MusicPlayer</span>
        </div>
        <div style="flex: 1; text-align: center;">
          © ${new Date().getFullYear()} Craft Launcher
        </div>
        <div style="flex: 1; text-align: right;">
          Built with <span style="color: #ec4899; font-weight: 600;">❤</span> | Special thanks to our community
        </div>
      </div>
    `;

    // Ajouter les éléments
    innerContent.appendChild(header);
    innerContent.appendChild(playerSection);
    innerContent.appendChild(playlistContainer);
    innerContent.appendChild(footer);
    content.appendChild(innerContent);
    this.modal.appendChild(content);
    document.getElementById('app').appendChild(this.modal);
    
    // ✅ Restaurer l'état si une playlist était active
    if (savedPlaylist && this.playlists[savedPlaylist]) {
      setTimeout(() => {
        this.playPlaylist(savedPlaylist);
        this.currentIndex = Math.min(savedIndex, this.playlists[savedPlaylist].tracks.length - 1);
        // ✅ Restaurer le temps de la musique
        this.audio.currentTime = savedTime;
        this.pause(); // Mettre en pause au lieu de reprendre
      }, 100);
    }

    // Fermer le modal
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    
    // Touche Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('radio-modal')) {
        this.close();
      }
    });

    // Afficher les playlists
    this.renderPlaylists(playlistContainer);

    // Listener pour la barre de progression
    const progressBar = document.getElementById('music-progress');
    progressBar.addEventListener('change', (e) => {
      if (this.audio.duration) {
        this.audio.currentTime = (e.target.value / 100) * this.audio.duration;
      }
    });

    // Mettre à jour la barre de progression
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.duration) {
        progressBar.value = (this.audio.currentTime / this.audio.duration) * 100;
        const currentTimeEl = document.getElementById('music-current-time');
        const durationEl = document.getElementById('music-duration');
        if (currentTimeEl) currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        if (durationEl) durationEl.textContent = this.formatTime(this.audio.duration);
      }
    });
  }

  renderPlaylists(container) {
    container.innerHTML = '';
    Object.keys(this.playlists).forEach(key => {
      const playlist = this.playlists[key];
      
      const card = document.createElement('div');
      card.dataset.playlist = key;
      card.style.cssText = 'padding: 20px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 12px; cursor: pointer; transition: all 0.3s;';
      
      const applyHoverStyle = () => {
        card.style.background = 'rgba(30, 41, 59, 0.8)';
        card.style.borderColor = 'rgba(99, 102, 241, 0.4)';
        card.style.transform = 'translateY(-4px)';
      };
      
      const removeHoverStyle = () => {
        card.style.background = 'rgba(30, 41, 59, 0.5)';
        card.style.borderColor = 'rgba(99, 102, 241, 0.15)';
        card.style.transform = 'translateY(0)';
      };
      
      const applySelectedStyle = () => {
        card.style.background = 'rgba(99, 102, 241, 0.15)';
        card.style.borderColor = '#6366f1';
        card.style.transform = 'translateY(-4px)';
      };
      
      card.onmouseover = () => {
        if (playlist.badge !== 'Soon') {
          applyHoverStyle();
        }
      };
      
      card.onmouseout = () => {
        if (this.currentPlaylistName === key) {
          applySelectedStyle();
        } else {
          removeHoverStyle();
        }
      };

      const badgeColor = playlist.badge === 'Premium' ? '#f59e0b' : playlist.badge === 'Soon' ? '#64748b' : '#a78bfa';
      const badgeIcon = '';
      const badgeRGB = playlist.badge === 'Premium' ? '245, 158, 11' : playlist.badge === 'Soon' ? '100, 116, 139' : '167, 139, 250';

      card.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 10px; opacity: ${playlist.badge === 'Soon' ? '0.5' : '1'};">${playlist.icon}</div>
        <h3 style="margin: 0 0 5px 0; color: #e2e8f0; font-size: 16px; font-weight: 700; opacity: ${playlist.badge === 'Soon' ? '0.6' : '1'};">${playlist.name}</h3>
        <p style="margin: 0 0 10px 0; color: #cbd5e1; font-size: 12px; opacity: ${playlist.badge === 'Soon' ? '0.5' : '1'};">${playlist.desc}</p>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: rgba(${badgeRGB}, 0.15); border-radius: 4px; color: ${badgeColor}; font-size: 11px; font-weight: 600;">${badgeIcon} ${playlist.badge}</span>
          <span style="color: #94a3b8; font-size: 12px;">${playlist.tracks.length} track(s)</span>
        </div>
      `;

      if (playlist.badge !== 'Soon') {
        card.addEventListener('click', () => {
          applySelectedStyle();
          this.playPlaylist(key);
        });
      } else {
        card.style.cursor = 'not-allowed';
        card.style.opacity = '0.6';
      }

      container.appendChild(card);
    });
  }

  playPlaylist(name) {
    if (!this.playlists[name]) {
      console.error('Playlist inconnue:', name);
      return;
    }

    this.currentPlaylistName = name;
    this.currentIndex = 0;
    const playlist = this.playlists[name];

    // ✅ Sauvegarder l'état
    localStorage.setItem('currentRadioPlaylist', name);
    localStorage.setItem('currentRadioIndex', '0');

    // Afficher la section lecteur
    document.getElementById('music-player-section').style.display = 'block';

    // Afficher le bouton next seulement pour phonk
    const nextBtn = document.getElementById('music-next-btn');
    if (nextBtn) {
      nextBtn.style.display = name === 'phonk' ? 'flex' : 'none';
    }

    // Mettre à jour l'affichage
    const nowPlaying = document.getElementById('music-now-playing');
    nowPlaying.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 10px;">${playlist.icon}</div>
      <div style="font-size: 20px; color: #e2e8f0; font-weight: 700;">${playlist.name}</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 5px;">${playlist.desc}</div>
    `;

    // Marquer les cartes
    document.querySelectorAll('#music-playlists > div').forEach((card) => {
      if (card.dataset.playlist === name) {
        card.style.background = 'rgba(99, 102, 241, 0.15)';
        card.style.borderColor = '#6366f1';
        card.style.transform = 'translateY(-4px)';
      } else {
        card.style.background = 'rgba(30, 41, 59, 0.5)';
        card.style.borderColor = 'rgba(99, 102, 241, 0.15)';
        card.style.transform = 'translateY(0)';
      }
    });

    // ✅ Mettre à jour le widget radio dans la titlebar
    this.updateRadioWidget(playlist, playlist.tracks[0]);

    this.play();
  }

  play() {
    if (!this.currentPlaylistName || !this.assetsPath) {
      console.warn('⚠️ Playlist ou assets path non chargés');
      return;
    }

    const playlist = this.playlists[this.currentPlaylistName];
    const file = playlist.files[this.currentIndex];
    const track = playlist.tracks[this.currentIndex];

    // ✅ Arrêter toute lecture en cours AVANT de charger une nouvelle source
    this.audio.pause();
    this.audio.currentTime = 0;

    try {
      // ✅ Construire le chemin absolu correct pour le fichier audio
      const path = require('path');
      const fs = require('fs');
      const audioPath = path.join(this.assetsPath, file);
      console.log('Tentative de lecture:', audioPath);
      
      // ✅ Lire le fichier en tant que buffer et le convertir en Blob URL
      // Cela fonctionne avec les fichiers empaquetés dans le .asar
      try {
        const fileBuffer = fs.readFileSync(audioPath);
        const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });
        const blobUrl = URL.createObjectURL(blob);
        
        // ✅ Attacher un listener pour canplay au lieu de play directement
        const playHandler = () => {
          this.audio.removeEventListener('canplay', playHandler);
          const playAttempt = this.audio.play();
          if (playAttempt !== undefined) {
            playAttempt.catch(err => {
              console.error('Erreur lors de play():', err);
              const trackInfo = document.getElementById('music-track-info');
              if (trackInfo) {
                trackInfo.textContent = 'Impossible de lire le fichier: ' + err.message;
              }
            });
          }
        };

        // ✅ Écouter quand le fichier peut être joué
        this.audio.addEventListener('canplay', playHandler, { once: true });
        
        // ✅ Ajouter un listener d'erreur pour les problèmes de chargement
        const errorHandler = (e) => {
          this.audio.removeEventListener('error', errorHandler);
          console.error('Erreur de chargement audio:', this.audio.error);
          const trackInfo = document.getElementById('music-track-info');
          if (trackInfo) {
            const errorMsg = this.audio.error?.message || 'Erreur inconnue';
            trackInfo.textContent = 'Impossible de charger: ' + errorMsg;
          }
        };
        this.audio.addEventListener('error', errorHandler, { once: true });

        // ✅ Charger la source depuis le Blob URL
        this.audio.src = blobUrl;
      } catch (fileError) {
        console.error('Erreur lecture du fichier:', fileError);
        const trackInfo = document.getElementById('music-track-info');
        if (trackInfo) {
          trackInfo.textContent = 'Fichier audio non trouvé: ' + file;
        }
      }
    } catch (err) {
      console.error('Erreur initialisation audio:', err);
    }

    // Mettre à jour le bouton Pause pour afficher "Pause"
    const pauseBtn = document.getElementById('music-pause-btn');
    if (pauseBtn) {
      pauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause';
    }

    const trackInfo = document.getElementById('music-track-info');
    if (trackInfo) {
      trackInfo.textContent = `${track.title} (${track.duration})`;
    }
  }

  resume() {
    // ✅ Utiliser une promesse pour attendre que play() soit prêt
    const resumeAttempt = this.audio.play();
    if (resumeAttempt !== undefined) {
      resumeAttempt
        .then(() => {
          console.log('✅ Lecture reprise avec succès');
        })
        .catch(err => {
          // Ne pas log si c'est un avertissement CSP
          if (!err.message.includes('interrupted')) {
            console.error('Erreur lors de la reprise:', err);
          }
        });
    }
  }

  pause() {
    this.audio.pause();
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    const pauseBtn = document.getElementById('music-pause-btn');
    if (pauseBtn) {
      pauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play';
    }
    // ✅ Réinitialiser le widget
    const stationName = document.getElementById('radio-station-name');
    const trackName = document.getElementById('radio-track-name');
    if (stationName) stationName.textContent = 'Pas de musique';
    if (trackName) trackName.textContent = 'Sélectionne une playlist';
  }

  next() {
    if (!this.currentPlaylistName) return;

    const playlist = this.playlists[this.currentPlaylistName];
    this.currentIndex++;
    if (this.currentIndex >= playlist.files.length) {
      this.currentIndex = 0;
    }
    // ✅ Mettre à jour le widget radio
    this.updateRadioWidget(playlist, playlist.tracks[this.currentIndex]);
    this.play();
  }

  updateRadioWidget(playlist, track) {
    const radioWidget = document.getElementById('radio-widget');
    if (radioWidget) {
      const stationName = document.getElementById('radio-station-name');
      const trackName = document.getElementById('radio-track-name');
      if (stationName) stationName.textContent = `${playlist.name}`;
      if (trackName) trackName.textContent = track ? track.title.substring(0, 50) : 'En lecture...';
    }
  }

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  close() {
    // ✅ NE PAS arrêter la musique - la laisser jouer en arrière-plan
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }
  }
}

module.exports = MusicPlayer;