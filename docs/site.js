const nav = document.querySelector('.nav-wrap')
const menu = document.querySelector('.mobile-menu')

window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 20), { passive: true })

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    }
  }
}, { threshold: 0.12 })

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element))

menu?.addEventListener('click', () => {
  const expanded = menu.getAttribute('aria-expanded') === 'true'
  menu.setAttribute('aria-expanded', String(!expanded))
})
