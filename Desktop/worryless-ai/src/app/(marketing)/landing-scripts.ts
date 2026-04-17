export const landingScripts = `
    // Typewriter effect — driven by carousel card index
    // Only the name and role animate; "Meet" and "your AI" stay static
    // Card index: 0 = Angela, 1 = Kai, 2 = Helena
    var heroTypewriter = (function() {
      var cardData = [
        { name: 'Helena,', role: 'digital marketer.' },
        { name: 'Sam,', role: 'SEO/GEO manager.' },
        { name: 'Kai,', role: 'social listening manager.' },
        { name: 'Angela,', role: 'email marketer.' }
      ];
      var nameEl = document.querySelector('.typewriter-name');
      var roleEl = document.querySelector('.typewriter-role');
      if (!nameEl || !roleEl) return { setCard: function(){} };

      var typeSpeed = 45;
      var eraseSpeed = 22;
      var activeCardIndex = null;
      var busy = false;
      var pendingCardIndex = null;

      var dissolveDuration = 400; // matches CSS transition duration

      function typeText(el, text, cb) {
        var i = 0;
        (function step() {
          if (i < text.length) {
            i++;
            el.textContent = text.substring(0, i);
            setTimeout(step, typeSpeed);
          } else if (cb) cb();
        })();
      }

      function eraseText(el, cb) {
        var text = el.textContent;
        var i = text.length;
        (function step() {
          if (i > 0) {
            i--;
            el.textContent = text.substring(0, i);
            setTimeout(step, eraseSpeed);
          } else if (cb) cb();
        })();
      }

      function dissolveName(newName, cb) {
        nameEl.classList.add('dissolve');
        setTimeout(function() {
          nameEl.textContent = newName;
          nameEl.classList.remove('dissolve');
          setTimeout(function() {
            if (cb) cb();
          }, dissolveDuration);
        }, dissolveDuration);
      }

      function transitionTo(cardIdx) {
        busy = true;
        var data = cardData[cardIdx];

        if (activeCardIndex === null) {
          // First load — show name, type role
          activeCardIndex = cardIdx;
          nameEl.textContent = data.name;
          nameEl.classList.remove('dissolve');
          typeText(roleEl, data.role, function() {
            busy = false;
            checkPending();
          });
          return;
        }

        // Erase role, dissolve name, type new role
        eraseText(roleEl, function() {
          activeCardIndex = cardIdx;
          dissolveName(data.name, function() {
            typeText(roleEl, data.role, function() {
              busy = false;
              checkPending();
            });
          });
        });
      }

      function checkPending() {
        if (pendingCardIndex !== null && pendingCardIndex !== activeCardIndex) {
          var idx = pendingCardIndex;
          pendingCardIndex = null;
          transitionTo(idx);
        }
      }

      function setCard(cardIdx) {
        if (cardIdx === activeCardIndex && !busy) return;
        if (busy) {
          pendingCardIndex = cardIdx;
          return;
        }
        transitionTo(cardIdx);
      }

      return { setCard: setCard };
    })();

    // Navbar sliding pill indicator
    (function() {
      var menu = document.querySelector('.navbar-menu');
      var slider = document.querySelector('.nav-slider');
      var links = document.querySelectorAll('.navbar-menu a');
      if (!menu || !slider || !links.length) return;

      function moveSlider(el) {
        var menuRect = menu.getBoundingClientRect();
        var elRect = el.closest('li').getBoundingClientRect();
        var offsetLeft = elRect.left - menuRect.left;
        slider.style.width = elRect.width + 'px';
        slider.style.transform = 'translateX(' + offsetLeft + 'px)';
      }

      // Position on initial active item (no transition)
      var activeLink = menu.querySelector('a.active');
      if (activeLink) {
        slider.style.transition = 'none';
        moveSlider(activeLink);
        // Force reflow then re-enable transition
        slider.offsetHeight;
        slider.style.transition = '';
      }

      links.forEach(function(link) {
        link.addEventListener('click', function(e) {
          links.forEach(function(l) { l.classList.remove('active'); });
          link.classList.add('active');
          moveSlider(link);
        });
      });

      // Reposition on resize
      window.addEventListener('resize', function() {
        var current = menu.querySelector('a.active');
        if (current) moveSlider(current);
      });
    })();

    // Navbar CTA: hidden initially, fade in after scrolling past hero CTA
    document.addEventListener('DOMContentLoaded', function() {
      var navCta = document.querySelector('.navbar-cta');
      var heroCta = document.querySelector('.hero-cta');
      if (!navCta || !heroCta) return;

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            // When hero CTA is NOT intersecting (scrolled past it), show nav CTA
            if (!entry.isIntersecting) {
              navCta.classList.add('visible');
            } else {
              navCta.classList.remove('visible');
            }
          });
        }, { threshold: 0 });

        observer.observe(heroCta);
      } else {
        // Fallback: show after scrolling 500px
        window.addEventListener('scroll', function() {
          if (window.scrollY > 500) {
            navCta.classList.add('visible');
          } else {
            navCta.classList.remove('visible');
          }
        });
      }
    });

    // Rive character animation integration
    // Uses WebGL renderer for full feature support (meshes, effects, raster images)
    // Falls back to static images if Rive fails to load
    (function() {
      var RIVE_CDN = 'https://unpkg.com/@rive-app/webgl@2.34.3';

      function initRiveElement(el, src, canvas) {
        try {
          var r = new rive.Rive({
            src: src,
            canvas: canvas,
            autoplay: true,
            fit: rive.Fit.Cover,
            useOffscreenRenderer: true,
            onLoad: function() {
              console.log('Rive loaded:', src, 'animations:', r.animationNames, 'stateMachines:', r.stateMachineNames);
              // If file has state machines but no standalone animations, play the first state machine
              if (r.stateMachineNames && r.stateMachineNames.length > 0) {
                r.play(r.stateMachineNames[0]);
              }
              el.classList.add('rive-loaded');
            },
            onLoadError: function(e) {
              console.warn('Rive failed to load:', src, e);
            }
          });
        } catch (e) {
          console.warn('Rive init error:', src, e);
        }
      }

      function initRive() {
        // Initialize Rive for hero cards
        var heroCards = document.querySelectorAll('.hero-card[data-rive-src]');
        heroCards.forEach(function(card) {
          var src = card.getAttribute('data-rive-src');
          var canvas = card.querySelector('.rive-canvas');
          if (src && canvas) initRiveElement(card, src, canvas);
        });

        // Initialize Rive for solution bento tiles
        var tiles = document.querySelectorAll('.solution-card-visual[data-rive-src]');
        tiles.forEach(function(tile) {
          var src = tile.getAttribute('data-rive-src');
          var canvas = tile.querySelector('.rive-canvas');
          if (src && canvas) initRiveElement(tile, src, canvas);
        });
      }

      // Load Rive WebGL runtime
      var script = document.createElement('script');
      script.src = RIVE_CDN;
      script.onload = function() {
        console.log('Rive WebGL runtime v2.34.3 loaded');
        initRive();
      };
      script.onerror = function() {
        console.warn('Rive runtime failed to load. Using static fallback images.');
      };
      document.head.appendChild(script);
    })();

    // Value proposition count-up animation
    document.addEventListener('DOMContentLoaded', function() {
      var valueCards = document.querySelectorAll('.value-card-number[data-target]');
      if (!valueCards.length || !('IntersectionObserver' in window)) {
        // Fallback: show final values immediately
        valueCards.forEach(function(el) {
          var prefix = el.dataset.prefix || '';
          var suffix = el.dataset.suffix || '';
          var decimals = parseInt(el.dataset.decimals) || 0;
          var target = parseFloat(el.dataset.target);
          el.textContent = prefix + (decimals > 0 ? target.toFixed(decimals) : Math.round(target)) + suffix;
        });
        return;
      }

      var hasAnimated = false;

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function animateNumber(el, delay) {
        var target = parseFloat(el.dataset.target);
        var prefix = el.dataset.prefix || '';
        var suffix = el.dataset.suffix || '';
        var decimals = parseInt(el.dataset.decimals) || 0;
        var duration = 1200; // 1200ms

        setTimeout(function() {
          var startTime = null;

          function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var elapsed = timestamp - startTime;
            var progress = Math.min(elapsed / duration, 1);
            var easedProgress = easeOutCubic(progress);
            var current = easedProgress * target;

            if (decimals > 0) {
              el.textContent = prefix + current.toFixed(decimals) + suffix;
            } else {
              el.textContent = prefix + Math.round(current) + suffix;
            }

            if (progress < 1) {
              requestAnimationFrame(step);
            }
          }

          requestAnimationFrame(step);
        }, delay);
      }

      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !hasAnimated) {
            hasAnimated = true;
            observer.disconnect();

            // Stagger animations with 75ms delay between each card
            valueCards.forEach(function(el, index) {
              animateNumber(el, index * 75);
            });
          }
        });
      }, { threshold: 0.3 });

      // Observe the section itself so all cards trigger together
      var section = document.querySelector('.value-prop-section');
      if (section) {
        observer.observe(section);
      }
    });

    // Purple column reveal animation on comparison table
    document.addEventListener('DOMContentLoaded', function() {
      var comparisonTable = document.querySelector('.comparison-table');
      if (!comparisonTable || !('IntersectionObserver' in window)) {
        if (comparisonTable) comparisonTable.classList.add('purple-reveal');
        return;
      }

      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            comparisonTable.classList.add('purple-reveal');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });

      observer.observe(comparisonTable);
    });

    // Comparison tabs: click to scroll + scroll to update active tab
    document.addEventListener('DOMContentLoaded', function() {
      var tabs = document.querySelectorAll('.comparison-tab');
      var table = document.querySelector('.comparison-table');
      if (!tabs.length || !table) return;

      // Map of column order on mobile: AI first, then Agencies, then Human
      var colOrder = ['col-ai', 'col-agencies', 'col-human'];

      // Tab click → scroll to column
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function() {
          var targetId = tab.getAttribute('data-target');
          var targetCol = document.getElementById(targetId);
          if (!targetCol) return;
          // Find visual position (order-based index)
          var colIndex = colOrder.indexOf(targetId);
          if (colIndex < 0) colIndex = 0;
          table.scrollTo({ left: colIndex * table.offsetWidth, behavior: 'smooth' });
          // Update active tab immediately
          tabs.forEach(function(t) { t.classList.remove('active'); });
          tab.classList.add('active');
        });
      });

      // Scroll → update active tab
      var scrollTimer;
      table.addEventListener('scroll', function() {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function() {
          var scrollPos = table.scrollLeft;
          var colWidth = table.offsetWidth;
          var activeIndex = Math.round(scrollPos / colWidth);
          if (activeIndex < 0) activeIndex = 0;
          if (activeIndex >= colOrder.length) activeIndex = colOrder.length - 1;
          var activeColId = colOrder[activeIndex];
          tabs.forEach(function(t) {
            if (t.getAttribute('data-target') === activeColId) {
              t.classList.add('active');
            } else {
              t.classList.remove('active');
            }
          });
        }, 50);
      });
    });

    // Highlight wipe-in animation on scroll into viewport
    document.addEventListener('DOMContentLoaded', function() {
      var highlights = document.querySelectorAll('.highlight, .highlight-blue, .highlight-green');
      if (!highlights.length || !('IntersectionObserver' in window)) {
        // Fallback: show all highlights immediately
        highlights.forEach(function(el) { el.classList.add('animate-in'); });
        return;
      }

      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            // Delay 250ms after section enters viewport
            setTimeout(function() {
              entry.target.classList.add('animate-in');
            }, 250);
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });

      highlights.forEach(function(el) {
        observer.observe(el);
      });
    });

    // Card rotations are now set via CSS classes (tcard-purple, tcard-blue, tcard-green)

    // Show more / Show less toggle for footer lists
    document.addEventListener('DOMContentLoaded', function() {
      var showMoreBlog = document.getElementById('show-more-blog');
      if (showMoreBlog) {
        showMoreBlog.addEventListener('click', function() {
          var items = document.querySelectorAll('#blog-links .blog-item');
          var hidden = document.querySelectorAll('#blog-links .blog-item[style*="display: none"]');
          if (hidden.length > 0) {
            items.forEach(function(item) { item.style.display = ''; });
            showMoreBlog.textContent = 'Show less';
          } else {
            items.forEach(function(item, i) { if (i >= 10) item.style.display = 'none'; });
            showMoreBlog.textContent = 'Show more';
          }
        });
      }

      var showMoreTools = document.getElementById('show-more-tools');
      if (showMoreTools) {
        showMoreTools.addEventListener('click', function() {
          var items = document.querySelectorAll('#tools-links .tool-item');
          var hidden = document.querySelectorAll('#tools-links .tool-item[style*="display: none"]');
          if (hidden.length > 0) {
            items.forEach(function(item) { item.style.display = ''; });
            showMoreTools.textContent = 'Show less';
          } else {
            items.forEach(function(item, i) { if (i >= 10) item.style.display = 'none'; });
            showMoreTools.textContent = 'Show more';
          }
        });
      }
    });

    // Hero 3D Carousel — synced with typewriter
    (function() {
      var cards = document.querySelectorAll('.hero-cards .hero-card');
      var dots = document.querySelectorAll('.hero-carousel-dot');
      var prevBtn = document.querySelector('.hero-carousel-nav--prev');
      var nextBtn = document.querySelector('.hero-carousel-nav--next');
      if (!cards.length) return;

      // Current center index (card at data-pos="center")
      // Card order: 0=Angela, 1=Kai, 2=Helena, 3=Sam
      var centerIndex = 0;
      var autoInterval;
      var AUTO_DELAY = 4000;

      // Agent page URLs per card index
      var agentUrls = [
        '/ai-digital-marketing-agent',
        '/ai-seo-geo-agent',
        '/ai-social-listening-agent',
        '/ai-email-marketing-agent'
      ];

      function setPositions() {
        var total = cards.length;
        cards.forEach(function(card, i) {
          var offset = (i - centerIndex + total) % total;
          var pos;
          if (offset === 0) pos = 'center';
          else if (offset === 1) pos = 'right';
          else if (offset === total - 1) pos = 'left';
          else pos = 'hidden';
          card.setAttribute('data-pos', pos);
        });
        dots.forEach(function(dot, i) {
          dot.classList.toggle('active', i === centerIndex);
        });
        // Sync typewriter headline with centered card
        if (typeof heroTypewriter !== 'undefined') {
          heroTypewriter.setCard(centerIndex);
        }
      }

      function goNext() {
        centerIndex = (centerIndex + 1) % cards.length;
        setPositions();
      }

      function goPrev() {
        centerIndex = (centerIndex - 1 + cards.length) % cards.length;
        setPositions();
      }

      function goTo(index) {
        centerIndex = index;
        setPositions();
      }

      function startAuto() {
        stopAuto();
        autoInterval = setInterval(goNext, AUTO_DELAY);
      }

      function stopAuto() {
        if (autoInterval) clearInterval(autoInterval);
      }

      // Click side cards to bring to center; click center card to navigate to agent page
      cards.forEach(function(card, i) {
        card.addEventListener('click', function() {
          if (card.getAttribute('data-pos') === 'center') {
            if (agentUrls[i]) window.location.href = agentUrls[i];
          } else if (card.getAttribute('data-pos') !== 'hidden') {
            goTo(i);
            startAuto();
          }
        });
      });

      if (nextBtn) {
        nextBtn.addEventListener('click', function() {
          goNext();
          startAuto();
        });
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', function() {
          goPrev();
          startAuto();
        });
      }

      dots.forEach(function(dot) {
        dot.addEventListener('click', function() {
          var idx = parseInt(dot.getAttribute('data-index'), 10);
          goTo(idx);
          startAuto();
        });
      });

      // Pause auto-rotation when hovering the wrapper
      var wrapper = document.querySelector('.hero-cards-wrapper');
      if (wrapper) {
        wrapper.addEventListener('mouseenter', stopAuto);
        wrapper.addEventListener('mouseleave', startAuto);
      }

      // Initial state & auto start
      setPositions();
      startAuto();
    })();
function normalizeUrl(value) {
  value = value.trim();
  if (!value) return value;
  if (!/^https?:\/\//i.test(value)) {
    value = 'https://' + value;
  }
  return value;
}

function isValidUrl(url) {
  if (!url) return false;
  try {
    var parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) && /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(parsed.hostname);
  } catch(e) {
    return false;
  }
}

function showSuccessState(messageBody, agentName) {
  var bubbles = messageBody.querySelectorAll('.message-bubble');
  var form = messageBody.querySelector('.message-form');
  bubbles.forEach(function(b) { b.style.display = 'none'; });
  if (form) form.style.display = 'none';

  var successDiv = document.createElement('div');
  successDiv.className = 'message-success-state';
  var successMsg = 'Thanks for your interest in ' + agentName + '. Someone from our team will reach out shortly to help you get started.';
  successDiv.innerHTML = '<div class="success-checkmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div><h3 class="success-title">You\'re In!</h3><p class="success-subtitle">' + successMsg + '</p>';
  messageBody.appendChild(successDiv);
  messageBody.scrollTop = 0;
}

(function() {
  var modal = document.getElementById('agentModal');
  var closeBtn = modal.querySelector('.agent-modal-close');
  var overlay = modal.querySelector('.agent-modal-overlay');
  var allCTAs = document.querySelectorAll('.get-started-cta');

  function trackEvent(name, props) {
    if (typeof gtag === 'function') gtag('event', name, props || {});
    if (typeof mixpanel !== 'undefined' && mixpanel.track) mixpanel.track(name, props || {});
  }

  function openModal(src) {
    trackEvent('Agent Modal Opened', { category:'contractor_signup', cta_location:src, page_url:window.location.pathname });
    modal.classList.add('active');
    modal.dataset.ctaSource = src;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    trackEvent('Agent Modal Closed', { category:'contractor_signup', cta_location:modal.dataset.ctaSource||'unknown' });
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Wire all .get-started-cta buttons
  allCTAs.forEach(function(cta) {
    cta.addEventListener('click', function(e) {
      e.preventDefault();
      var loc = 'other';
      if (cta.classList.contains('navbar-cta')) loc = 'navbar';
      else if (cta.classList.contains('hero-cta')) loc = 'hero';
      else if (cta.classList.contains('cta-button')) loc = 'bottom_cta';
      trackEvent('Get Started CTA Clicked', { category:'engagement', cta_location:loc });
      openModal(loc);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });

  // --- Agent card handlers ---
  var agentModal = modal;

  // Helper: setup a message modal
  function setupMessageModal(cardId, modalId, formId, statusId, agentName, agentRole, buildData) {
    var card = document.getElementById(cardId);
    var msgModal = document.getElementById(modalId);
    if (!card || !msgModal) return;
    var msgClose = msgModal.querySelector('.message-close');
    var msgOverlay = msgModal.querySelector('.message-modal-overlay');
    var form = document.getElementById(formId);
    var formStatus = document.getElementById(statusId);

    function openMsg() {
      agentModal.classList.remove('active');
      msgModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeMsg() {
      msgModal.classList.remove('active');
      document.body.style.overflow = '';
    }

    card.addEventListener('click', function() {
      trackEvent('Agent Selected', { category:'contractor_signup', agent_name:agentName, agent_role:agentRole });
      openMsg();
    });
    if (msgClose) msgClose.addEventListener('click', closeMsg);
    if (msgOverlay) msgOverlay.addEventListener('click', closeMsg);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && msgModal.classList.contains('active')) closeMsg(); });

    if (form) {
      form.addEventListener('submit', async function(e) {
        e.preventDefault();
        var fd = new FormData(form);
        var data = buildData(fd);
        if (!data) return; // validation failed

        trackEvent('Form Submitted', { category:'contractor_signup', agent_name:agentName });
        var btn = form.querySelector('.message-send-btn');
        btn.disabled = true;
        btn.classList.add('sending');
        btn.innerHTML = '<span class="send-text">Sending<span class="sending-dots"><span></span><span></span><span></span></span></span>';

        try {
          var resp = await fetch('/api/specialist-inquiry', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
          if (resp.ok) {
            trackEvent('conversion', { send_to:'G-JH8LKEMCPG', event_category:'contractor_signup', agent_name:agentName, value:1 });
            var messageBody = msgModal.querySelector('.message-body');
            if (messageBody) {
              showSuccessState(messageBody, agentName);
            }
          } else { throw new Error('Failed'); }
        } catch(err) {
          formStatus.className = 'form-status error';
          formStatus.textContent = 'Oops! Something went wrong. Please try again or email us at support@worryless.ai';
        } finally {
          btn.disabled = false;
          btn.classList.remove('sending');
          btn.innerHTML = '<span class="send-text">Send</span><svg class="send-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
        }
      });
    }
  }

  // Kai
  setupMessageModal('kaiCardBtn', 'kaiMessageModal', 'kaiMessageForm', 'kaiFormStatus', 'Kai', 'Social Listening Manager', function(fd) {
    var platforms = Array.from(fd.getAll('platforms'));
    if (platforms.length === 0) {
      document.getElementById('kaiFormStatus').className = 'form-status error';
      document.getElementById('kaiFormStatus').textContent = 'Please select at least one platform to monitor.';
      document.getElementById('kaiFormStatus').style.display = 'block';
      return null;
    }
    var websiteUrl = normalizeUrl(fd.get('websiteUrl'));
    if (!isValidUrl(websiteUrl)) {
      document.getElementById('kaiFormStatus').className = 'form-status error';
      document.getElementById('kaiFormStatus').textContent = 'Please enter a valid website URL (e.g. yourwebsite.com).';
      document.getElementById('kaiFormStatus').style.display = 'block';
      return null;
    }
    return { specialist:'Kai', workEmail:fd.get('workEmail'), websiteUrl:websiteUrl, platforms:platforms, competitors:(fd.get('competitors')||'').trim(), keywords:(fd.get('keywords')||'').trim(), trends:(fd.get('trends')||'').trim() };
  });

  // Angela
  setupMessageModal('angelaCardBtn', 'angelaMessageModal', 'angelaMessageForm', 'angelaFormStatus', 'Angela', 'Email Marketing Specialist', function(fd) {
    var websiteUrl = normalizeUrl(fd.get('websiteUrl'));
    if (!isValidUrl(websiteUrl)) {
      document.getElementById('angelaFormStatus').className = 'form-status error';
      document.getElementById('angelaFormStatus').textContent = 'Please enter a valid website URL (e.g. yourwebsite.com).';
      document.getElementById('angelaFormStatus').style.display = 'block';
      return null;
    }
    return { specialist:'Angela', workEmail:fd.get('workEmail'), websiteUrl:websiteUrl, emailPlatform:(fd.get('emailPlatform')||'').trim() };
  });

  // Sam
  setupMessageModal('samCardBtn', 'samMessageModal', 'samMessageForm', 'samFormStatus', 'Sam', 'SEO/GEO Content Marketer', function(fd) {
    var websiteUrl = normalizeUrl(fd.get('websiteUrl'));
    if (!isValidUrl(websiteUrl)) {
      document.getElementById('samFormStatus').className = 'form-status error';
      document.getElementById('samFormStatus').textContent = 'Please enter a valid website URL (e.g. yourwebsite.com).';
      document.getElementById('samFormStatus').style.display = 'block';
      return null;
    }
    return { specialist:'Sam', workEmail:fd.get('workEmail'), websiteUrl:websiteUrl };
  });

  // Helena — redirect to registration page instead of opening modal
  (function() {
    var helenaCard = document.getElementById('helenaCardBtn');
    if (helenaCard) {
      helenaCard.addEventListener('click', function() {
        trackEvent('Agent Selected', { category:'contractor_signup', agent_name:'Helena', agent_role:'Digital Marketing Specialist' });
        window.location.href = '#cta';
      });
    }
  })();
})();
`;
