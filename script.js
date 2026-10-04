document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const navWrap = document.querySelector('.nav-wrap');
  const form = document.getElementById('heroQuoteForm');
  const formError = document.getElementById('formError');
  const formSuccess = document.getElementById('formSuccess');
  const yearEl = document.getElementById('year');

  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const handleScrollState = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };

  handleScrollState();
  window.addEventListener('scroll', handleScrollState, { passive: true });

  if (navToggle && navWrap) {
    navToggle.addEventListener('click', () => {
      const isOpen = navWrap.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    document.querySelectorAll('.main-nav a').forEach((link) => {
      link.addEventListener('click', () => {
        navWrap.classList.remove('nav-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  if (form) {
    const setFieldError = (field, message) => {
      if (formError) {
        formError.textContent = message;
        formError.classList.add('error');
      }
      if (field) {
        field.style.borderColor = 'rgba(161, 40, 40, 0.5)';
      }
    };

    const clearFieldError = (field) => {
      if (formError) {
        formError.classList.remove('error');
        formError.textContent = '';
      }
      if (formSuccess) {
        formSuccess.classList.remove('success');
        formSuccess.textContent = '';
      }
      if (field) {
        field.style.borderColor = 'rgba(26, 35, 41, 0.12)';
      }
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const nameField = form.querySelector('input[name="fullName"]');
      const mobileField = form.querySelector('input[name="mobile"]');
      const messageField = form.querySelector('textarea[name="message"]');
      const honeypot = form.querySelector('input[name="website"]');

      if (honeypot && honeypot.value.trim()) {
        return;
      }

      const fullName = nameField ? nameField.value.trim() : '';
      const mobile = mobileField ? mobileField.value.trim() : '';
      const message = messageField ? messageField.value.trim() : '';

      if (formError) {
        formError.classList.remove('error');
        formError.textContent = '';
      }
      if (formSuccess) {
        formSuccess.classList.remove('success');
        formSuccess.textContent = '';
      }

      if (!fullName || !mobile) {
        setFieldError(fullName ? mobileField : nameField, 'Please enter your name and mobile number.');
        return;
      }

      if (!/^\+?[0-9\s-]{8,15}$/.test(mobile)) {
        setFieldError(mobileField, 'Please enter a valid mobile number.');
        return;
      }

      const subject = encodeURIComponent(`New design enquiry from ${fullName}`);
      const body = encodeURIComponent(
        `Name: ${fullName}\nMobile: ${mobile}\nMessage: ${message || 'No additional message provided.'}`
      );

      form.reset();
      if (formSuccess) {
        formSuccess.textContent = 'Thank you! Your request has been received. Our design team will contact you shortly.';
        formSuccess.classList.add('success');
      }

      setTimeout(() => {
        window.location.href = `mailto:Shahnawazalam790@gmail.com?subject=${subject}&body=${body}`;
      }, 300);
    });

    form.querySelectorAll('input, textarea').forEach((field) => {
      field.addEventListener('input', () => {
        clearFieldError(field);
      });
    });
  }

});
