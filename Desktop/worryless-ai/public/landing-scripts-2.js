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
