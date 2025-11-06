import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { imagesOutline, musicalNotesOutline } from 'ionicons/icons';
import SlideshowsTab from './pages/SlideshowsTab';
import Tab2 from './pages/Tab2';
// import Tab3 from './pages/Tab3'; // Commented out for redesign (Stage 5 will reintegrate)

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <IonReactRouter>
      <IonTabs>
        <IonRouterOutlet>
          <Route exact path="/slideshows">
            <SlideshowsTab />
          </Route>
          <Route exact path="/music">
            <Tab2 />
          </Route>
          {/* Tab3 (Play) temporarily removed during redesign - will be reintegrated in Stage 5 */}
          {/* <Route path="/play">
            <Tab3 />
          </Route> */}
          <Route exact path="/">
            <Redirect to="/slideshows" />
          </Route>
        </IonRouterOutlet>
        <IonTabBar slot="bottom">
          <IonTabButton tab="slideshows" href="/slideshows">
            <IonIcon aria-hidden="true" icon={imagesOutline} />
            <IonLabel>Slideshows</IonLabel>
          </IonTabButton>
          <IonTabButton tab="music" href="/music">
            <IonIcon aria-hidden="true" icon={musicalNotesOutline} />
            <IonLabel>Music</IonLabel>
          </IonTabButton>
          {/* Play tab temporarily removed during redesign */}
          {/* <IonTabButton tab="play" href="/play">
            <IonIcon aria-hidden="true" icon={playCircleOutline} />
            <IonLabel>Play</IonLabel>
          </IonTabButton> */}
        </IonTabBar>
      </IonTabs>
    </IonReactRouter>
  </IonApp>
);

export default App;
