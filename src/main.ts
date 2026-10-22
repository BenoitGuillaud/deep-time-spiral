import './styles.css';
import { t } from './i18n/i18n';
import { renderSpiral } from './render/spiral-view';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app element');

document.title = t('app.title');

const heading = document.createElement('h1');
heading.textContent = t('app.title');
app.append(heading);

renderSpiral(app);
