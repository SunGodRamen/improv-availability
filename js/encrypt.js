// Encrypt ONLY metadata (_meta[...]) and leave regular form fields clear.
// - Collect all inputs whose name matches ^_meta[...]
// - Compress (pako.deflate) and hybrid-encrypt (AES-GCM 256 + RSA-OAEP SHA-256)
// - Write encrypted blob to _enc_meta (base64(JSON{ek,iv,ct}))
// - Remove/disable the original _meta[...] fields so Formspree never sees them in clear
//
// Requires:
//   - pako (CDN in index.html)
//   - window.RECIPIENT_PUBLIC_PEM (public key) from js/config.js
//   - optional: window.POLICY for spec version tagging

(() => {
  // --- helpers ---
  function bufToB64(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  }
  async function pemToArrayBuffer(pem) {
    const b64 = pem.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  async function importRecipientPublicKey(pem) {
    const spki = await pemToArrayBuffer(pem);
    return crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
  }
  async function hybridEncryptUint8(payloadUint8, recipientPubPem) {
    const pubKey = await importRecipientPublicKey(recipientPubPem);

    // 1) AES-GCM key
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const aesRaw = await crypto.subtle.exportKey('raw', aesKey);

    // 2) Encrypt payload with AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, payloadUint8);

    // 3) Wrap AES key with RSA-OAEP
    const ekBuf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, aesRaw);

    return {
      ek: bufToB64(ekBuf),
      iv: bufToB64(iv.buffer),
      ct: bufToB64(ctBuf),
    };
  }

  function ensureHidden(form, name) {
    let input = form.querySelector(`input[type="hidden"][name="${name}"]`);
    if (!input) {
      input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      form.appendChild(input);
    }
    return input;
  }

  function collectMeta(form) {
    // Grab ONLY _meta[...] pairs present in the DOM (populated by app.js)
    const meta = {};
    const metas = form.querySelectorAll('input[name^="_meta["], textarea[name^="_meta["], select[name^="_meta["]');
    metas.forEach(el => {
      // Normalize values like checkboxes/radios
      if (el.type === 'checkbox') {
        if (el.checked) meta[el.name] = el.value;
      } else if (el.type === 'radio') {
        if (el.checked) meta[el.name] = el.value;
      } else {
        meta[el.name] = el.value;
      }
    });
    return meta;
  }

  function stripMetaFromSubmission(form) {
    // Make sure cleartext _meta[...] do NOT get submitted
    const metas = form.querySelectorAll('input[name^="_meta["], textarea[name^="_meta["], select[name^="_meta["]');
    metas.forEach(el => {
      // safest is to remove the "name" so it can’t post; disable is also fine
      el.disabled = true;
      // Optionally: el.removeAttribute('name');
    });
  }

  async function encryptOnlyMeta(form) {
    const meta = collectMeta(form);
    // Tag the envelope
    const spec = (window.POLICY && window.POLICY.specVersion) ||
                 form.querySelector('[name="_spec_version"]')?.value ||
                 'v1';

    const envelope = {
      spec,
      type: 'meta-only',
      scheme: window.ENC_SCHEME || 'rsa-oaep+aesgcm+deflate',
      scheme_version: window.ENC_SCHEME_VERSION || 'v1',
      // Use compact keys inside the encrypted doc
      meta,
      ts: new Date().toISOString(),
    };

    const json = JSON.stringify(envelope);
    const compressed = pako.deflate(json); // Uint8Array

    if (!window.RECIPIENT_PUBLIC_PEM) throw new Error('Missing RECIPIENT_PUBLIC_PEM');

    const enc = await hybridEncryptUint8(compressed, window.RECIPIENT_PUBLIC_PEM);

    // Stash encrypted blob in _enc_meta (base64 of JSON)
    const encMeta = ensureHidden(form, '_enc_meta');
    encMeta.value = btoa(JSON.stringify(enc));

    // Make sure cleartext meta doesn’t ship
    stripMetaFromSubmission(form);
  }

  // Tiny UX cue
  function showEncrypting(form) {
    let n = form.querySelector('.encrypting-status');
    if (!n) {
      n = document.createElement('div');
      n.className = 'encrypting-status';
      n.style.cssText = 'margin-top:8px;font-weight:600;color:#1a73e8';
      form.appendChild(n);
    }
    n.textContent = 'Encrypting metadata…';
    return n;
  }
  function hideEncrypting(n) {
    if (n && n.parentNode) n.parentNode.removeChild(n);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('availability-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = showEncrypting(form);
      try {
        await encryptOnlyMeta(form);
        // let the message render briefly
        setTimeout(() => {
          form.submit(); // proceeds with CLEAR form fields + _enc_meta
          hideEncrypting(n);
        }, 120);
      } catch (err) {
        console.error('encrypt meta failed:', err);
        hideEncrypting(n);
        alert('Failed to encrypt metadata — please try again.');
      }
    });
  });
})();
