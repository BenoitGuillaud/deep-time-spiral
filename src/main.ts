import './styles.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element');

const heading = document.createElement('h1');
heading.textContent = 'Deep Time Spiral';
app.append(heading);
