(() => {
  const config = window.ICS_REVIEWS_CONFIG || {};
  const form = document.getElementById('customer-feedback');
  const status = document.getElementById('feedback-status');
  const list = document.getElementById('approved-reviews');
  const average = document.getElementById('review-average');
  const count = document.getElementById('review-count');
  const configured = config.url && config.anonKey &&
    !config.url.includes('YOUR_SUPABASE') && !config.anonKey.includes('YOUR_SUPABASE');
  const base = String(config.url || '').replace(/\/+$/, '');
  const headers = { apikey: config.anonKey || '', Authorization: 'Bearer ' + (config.anonKey || '') };

  function emptyMessage(message) {
    list.replaceChildren();
    const p = document.createElement('p');
    p.className = 'reviews-empty';
    p.textContent = message;
    list.appendChild(p);
  }
  function addText(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text == null ? '' : String(text);
    parent.appendChild(node);
    return node;
  }
  const params = new URLSearchParams(location.search);
  if (params.has('admin')) {
    const pin = prompt('Enter shop admin PIN to manage reviews');
    if (pin) sessionStorage.setItem('icsReviewPin', pin.trim());
  }
  function adminPin() { return sessionStorage.getItem('icsReviewPin') || ''; }
  async function deleteReview(id, button) {
    if (!confirm('Delete this review permanently?')) return;
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      const response = await fetch(base + '/rest/v1/rpc/delete_review', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: id, admin_pin: adminPin() })
      });
      if (!response.ok) {
        sessionStorage.removeItem('icsReviewPin');
        alert('Could not delete. The admin PIN may be wrong. Open the page with ?admin again.');
        button.disabled = false;
        button.textContent = 'Delete';
        return;
      }
      await loadReviews();
    } catch (_) {
      alert('Could not delete right now. Please try again.');
      button.disabled = false;
      button.textContent = 'Delete';
    }
  }
  async function loadReviews() {
    if (!configured) {
      emptyMessage('Customer reviews will appear here after the shop connects its review database.');
      average.textContent = 'Customer reviews';
      count.textContent = 'Be the first to leave a review';
      return;
    }
    try {
      const response = await fetch(base + '/rest/v1/reviews?select=id,name,product,rating,message,created_at&approved=eq.true&order=created_at.desc&limit=30', { headers });
      if (!response.ok) throw new Error('Review loading failed');
      const reviews = await response.json();
      count.textContent = reviews.length + ' approved review' + (reviews.length === 1 ? '' : 's');
      if (!reviews.length) {
        average.textContent = 'No ratings yet';
        emptyMessage('No approved reviews yet. Be the first to share your experience.');
        return;
      }
      const avg = reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length;
      average.textContent = '★ ' + avg.toFixed(1) + ' / 5 average';
      list.replaceChildren();
      reviews.forEach(item => {
        const card = document.createElement('article');
        card.className = 'review-card';
        const top = document.createElement('div');
        top.className = 'review-card-top';
        addText(top, 'strong', '', item.name || 'Customer');
        addText(top, 'span', 'review-stars', '★'.repeat(Number(item.rating)) + '☆'.repeat(5 - Number(item.rating)));
        card.appendChild(top);
        if (item.product) addText(card, 'small', 'review-product', 'Purchased: ' + item.product);
        addText(card, 'p', '', item.message);
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        addText(card, 'time', '', date);
        if (adminPin() && item.id != null) {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'review-delete';
          del.textContent = 'Delete';
          del.addEventListener('click', () => deleteReview(item.id, del));
          card.appendChild(del);
        }
        list.appendChild(card);
      });
    } catch (_) {
      emptyMessage('Reviews are temporarily unavailable. Please try again later.');
      count.textContent = 'Reviews temporarily unavailable';
    }
  }

  if (form) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!configured) {
        status.textContent = 'The review database has not been connected yet. Please try again later.';
        status.classList.add('status-error');
        return;
      }
      const data = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Submitting…';
      status.classList.remove('status-error');
      try {
        const response = await fetch(base + '/rest/v1/reviews', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            name: String(data.get('name') || '').trim() || null,
            rating: Number(data.get('rating')),
            message: String(data.get('message') || '').trim(),
            approved: false
          })
        });
        if (!response.ok) throw new Error('Review submission failed');
        form.reset();
        status.textContent = 'JazakAllah khair! Your review has been posted.';
        await loadReviews();
      } catch (_) {
        status.textContent = 'Sorry, your review could not be submitted. Please try again later.';
        status.classList.add('status-error');
      } finally {
        button.disabled = false;
        button.textContent = 'Submit review';
      }
    });
  }
  loadReviews();
})();
