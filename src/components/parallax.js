export function initParallax() {
    const heroSection = document.querySelector('.hero');
    const mockup = document.querySelector('.dashboard-mockup');

    if (!heroSection || !mockup) return;

    heroSection.addEventListener('mousemove', (e) => {
        const { offsetWidth: width, offsetHeight: height } = heroSection;
        const { clientX: x, clientY: y } = e;

        // Calculate rotation based on mouse position (max +/- 5 deg)
        const moveX = ((x / width) - 0.5) * 10;
        const moveY = ((y / height) - 0.5) * 10;

        mockup.style.transform = `perspective(1000px) rotateY(${moveX}deg) rotateX(${-moveY}deg) scale(1.02)`;
    });

    heroSection.addEventListener('mouseleave', () => {
        mockup.style.transform = `perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)`;
    });
}
