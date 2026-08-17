# Vallouise — le carnet de famille

PWA mono-fichier (index.html) + Firebase. Séjours, randos, bons plans, photos, mode d'emploi de l'appart.
Tout se synchronise en temps réel entre les membres, et reste consultable hors ligne (utile : le réseau est capricieux dans la vallée).

---

## 1. Créer le projet Firebase (10 min, gratuit)

1. **console.firebase.google.com** → *Créer un projet* → nom `vallouise` → Analytics : non.
2. **Authentication** → *Commencer* → onglet *Sign-in method* → activer **Anonyme**.
3. **Firestore Database** → *Créer une base* → mode **production** → région `eur3 (europe-west)`.
4. **Paramètres du projet** (roue crantée) → *Vos applications* → icône `</>` → nom `Vallouise` →
   copier l'objet `firebaseConfig` affiché.
5. Deux façons de renseigner ces valeurs :
   - **Rapide, pour tester** : ouvrir l'app telle quelle — un écran « Configuration Firebase » s'affiche,
     y coller le bloc copié, valider. Attention : c'est enregistré **dans ce navigateur uniquement**,
     donc à refaire sur chaque téléphone de la famille.
   - **Définitif** : coller le bloc dans `index.html`, tout en haut du `<script type="module">`
     (bloc « 1. CONFIGURATION FIREBASE »), puis redéployer. L'écran de configuration ne s'affiche plus
     pour personne. C'est la bonne solution une fois que ça marche.

> Les clés Firebase côté web sont publiques par nature : ce ne sont pas des secrets.
> C'est le rôle des règles ci-dessous de protéger les données.

---

## 2. Règles de sécurité Firestore

Firestore → onglet **Règles** → coller ceci → *Publier* :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function connecte()  { return request.auth != null; }
    function proprio()   { return request.auth.uid == resource.data.uid; }

    // Profils : chacun ne modifie que le sien
    match /membres/{uid} {
      allow read: if connecte();
      allow write: if connecte() && request.auth.uid == uid;
    }

    // Contenus : tout le monde lit, l'auteur seul modifie et supprime
    match /{col}/{id} {
      allow read:   if connecte() && col in ['sejours','randos','plans','photos','infos','prises','liens'];
      allow create: if connecte() && request.resource.data.uid == request.auth.uid;
      allow update: if connecte() && (proprio()
                      // randos, fiches pratiques et liens sont collaboratifs
                      || col == 'randos' || col == 'infos' || col == 'liens');
      // le mur photo est commun : chacun peut y faire le ménage
      allow delete: if connecte() && (proprio() || col == 'photos');
    }
  }
}
```

**Attention à un point** : l'authentification anonyme laisse entrer n'importe qui connaissant l'URL.
Pour une app familiale sur une URL non référencée c'est généralement suffisant. Si tu veux vraiment verrouiller :

- soit passer en **Authentification par e-mail** et n'inviter que les adresses de la famille ;
- soit ajouter une **liste blanche d'UID** dans les règles (`request.auth.uid in ['abc…','def…']`) une fois que chacun s'est connecté une première fois.

Dis-le-moi et je te fournis la variante.

---

## 3. Déploiement (GitHub Pages, comme tes autres apps)

```bash
git init && git add . && git commit -m "Vallouise v1"
git branch -M main
git remote add origin https://github.com/lebign/vallouise.git
git push -u origin main
```

Puis *Settings → Pages → Deploy from a branch → main / (root)*.
Ajouter le domaine `lebign.github.io` dans Firebase → **Authentication → Settings → Domaines autorisés**, sinon la connexion sera refusée.

À chaque mise à jour : incrémenter `CACHE = "vallouise-v1"` dans `service-worker.js`, sinon les téléphones gardent l'ancienne version en cache.

---

## 4. Photos — comment c'est stocké

Les photos sont **réduites dans le navigateur** (1400 px max, JPEG qualité 0,68) puis stockées en base64 directement dans Firestore, pour rester sur le forfait gratuit sans activer Firebase Storage (qui réclame une carte bancaire).

- Limite technique : 1 Mo par document Firestore. Une photo compressée pèse 200 à 600 Ko.
- Quota gratuit : 1 Gio de base + 50 000 lectures/jour. Compte environ **1 500 à 3 000 photos** avant de devoir migrer.
- Au-delà, la bonne évolution est Firebase Storage (plan Blaze, quelques centimes par mois) ou Cloudinary en gratuit.

---

## 5. Contenu des sections

| Section | Ce qu'on y met |
|---|---|
| **Séjours** | Calendrier des présences, une couleur par membre. Alerte si les dates se chevauchent, sans bloquer. |
| **Randos** | Fiches : départ, dénivelé, durée, niveau, conseil. **Import de trace GPX** (distance + D+ calculés, tracé dessiné), **plusieurs liens** par rando, **photos rattachées** (dès la création). Chacun coche « faite ». |
| **Bons plans** | Restaurants, commerces, activités, baignades, infos pratiques, notés sur 5. |
| **Accueil** | Météo + soleil, alertes illustrées, cartes de randos avec photo de couverture prise dans vos propres photos, webcams intégrées (lecteurs de l'office de tourisme), actualités en cartes horizontales publiables par la famille. |
| **Photos** | Mur commun, légende + auteur. Croix de suppression sur ses propres vignettes. |
| **L'appart** | Fiches pratiques éditables par tous : wifi, chauffage, poubelles, vanne d'eau, clés, voisins. |

---

## 6. Infos mairie (Vallouise-Pelvoux)

Arrêtés municipaux, actualités de la commune et bulletins, avec renvoi vers le fil Illiwap.
Bouton sur l'accueil, quatre onglets : Toutes les infos / Alertes & travaux / Arrêtés & actes / Bulletins.

**Pourquoi ce module ne peut pas être « temps réel ».** Ni vallouise-pelvoux.fr ni Illiwap
n'autorisent les requêtes croisées : le navigateur ne peut pas les interroger, quoi qu'on écrive
côté client. L'app lit donc `mairie.json`, servi depuis la même origine qu'elle.

**Pour l'actualiser automatiquement** : `scrape-mairie.py` récupère les trois pages et régénère
`mairie.json`. Le fichier contient en commentaire le workflow GitHub Actions prêt à coller
(`.github/workflows/mairie.yml`) : exécution quotidienne, commit du JSON, redéploiement de Pages.
Sans cette mise en place, l'app affiche l'instantané embarqué du 17/08/2026, avec sa date visible.

**Trois limites assumées :**
- un arrêté de circulation peut avoir expiré — la date affichée est celle de mise en ligne, pas d'effet ;
- le niveau d'urgence est déduit des mots du titre, ce n'est pas une qualification officielle ;
- les alertes réelles passent par Illiwap : le module y renvoie, il ne les duplique pas.

---

## 7. Randonnées du secteur (données Visorando)

38 itinéraires relevés sur `visorando.com/randonnee-vallouise.html` (départs Vallouise, Pelvoux,
Puy-Saint-Vincent, Les Vigneaux) sont **embarqués dans l'app** : aucun appel réseau, tout fonctionne
hors ligne. Accès par le bouton sous le carrousel de l'accueil, avec filtres difficulté / commune /
durée et recherche par nom.

Ce qui est repris et ce qui ne l'est pas :

| Repris | Non repris | Pourquoi |
|---|---|---|
| distance, D+, D−, durée, difficulté, activité, commune de départ | descriptifs rédigés | textes des contributeurs Visorando, protégés |
| lien vers la fiche d'origine | photographies | idem, et pointer vers leurs serveurs casserait au premier changement |

Le type de tracé (« Retour au départ » / « Aller simple ») n'est pas publié dans la liste : il est
déduit de l'écart entre D+ et D−.

Le fichier `randos-vallouise.json` et le script `build-randos-vallouise.py` permettent de régénérer
ou d'alimenter une base de données. Pour actualiser après ajout de circuits sur Visorando, relever
la page et relancer le script.

---

## 8. Apparence

Onglet **L'appart › Apparence** : Automatique (suit le réglage du téléphone), Clair ou Sombre.
Le choix est retenu dans `localStorage` (`vl-theme`) et appliqué avant le premier affichage par un
petit script en tête de page — pas de clignotement clair au chargement. La barre d'état du téléphone
(`theme-color`) suit le thème actif. En mode Automatique, un changement de réglage iOS est répercuté
en direct, sans relancer l'app.

---

## 9. Dépannage

**Un bouton ne fait rien / rien ne s'enregistre.** L'app affiche désormais un bandeau rouge ou un message
d'erreur explicite dans les trois cas possibles :

| Message | Cause | Correctif |
|---|---|---|
| « Configuration Firebase absente » | `firebaseConfig` pas rempli | étape 1 |
| « Connexion refusée » | connexion anonyme désactivée, ou domaine absent des domaines autorisés | étapes 1.2 et 3 |
| « Écriture refusée par Firestore » | règles de sécurité non publiées | étape 2 |

Si rien ne s'affiche du tout : ouvrir la console du navigateur (sur Android, Chrome → `chrome://inspect`
depuis le PC) et me transmettre le message d'erreur.

**Une photo refuse de disparaître.** Trois causes possibles, l'app vous dit laquelle :

| Message affiché | Cause | Correctif |
|---|---|---|
| « Refusé par Firestore » | la règle `allow delete` n'est pas publiée | republier les règles (étape 2) |
| « n'a jamais atteint le serveur » | la photo n'existe que dans le cache local (créée hors ligne et refusée à l'envoi) | Appart › Réinitialiser l'application |
| rien, la photo revient au rechargement | écriture encore en attente | attendre la synchro, sablier ⌛ sur la vignette |

Une randonnée supprimée suit exactement la même logique (clé `vl-randos-masquees`) : elle disparaît
à l'instant du clic, ne revient pas au rechargement, et ses photos rattachées partent avec elle.

Depuis la v19, une photo supprimée **reste masquée sur l'appareil quoi qu'il arrive** (liste retenue
dans `localStorage`, clé `vl-photos-masquees`), sans message d'erreur d'autorisation. Attention à ce
que cela implique : tant que la règle `allow delete` n'est pas publiée, la photo existe toujours
côté serveur et reste visible pour les autres membres. Un message discret le rappelle une fois.

**Après une mise à jour, le téléphone garde l'ancienne version.** Incrémenter `CACHE` dans
`service-worker.js`, ou désinstaller/réinstaller la PWA.

---

## 10. Cartes de randos, webcams, actualités

**Cartes de randos suggérées** : format compact, sans image — nom, commune, distance, dénivelé,
durée, badge de difficulté et lien vers la fiche Visorando. Les photos restent réservées aux randos
du carnet et au mur Photos.

**Webcams** : l'app intègre les lecteurs publiés par l'office de tourisme du Pays des Écrins
(`vision-environnement.com/live/player/...`), sélectionnables entre Front de neige, Secteur 1800 m,
Crête 2300 m et Nordique. Si un lecteur refuse l'intégration, le bouton « Ouvrir le flux webcam
complet » prend le relais.

**Actualités** : il n'existe pas de flux RSS local exploitable depuis un navigateur (les serveurs
de presse bloquent les requêtes croisées). Les actualités sont donc publiées par la famille —
titre, résumé, date, lien, illustration — et présentées en cartes horizontales, suivies des
sources permanentes (office de tourisme, station, parc national, vigilance).

---

## 11. Traces GPX et app Exercice d'Apple

L'app Exercice/Fitness d'Apple **ne fournit pas de lien public partageable** : le partage produit une
image de résumé, pas une URL exploitable. Pour récupérer une trace d'une séance Apple :

- **HealthFit** (payant, ~5 €) ou **WorkOutDoors** : lisent les séances de l'app Exercice et exportent
  en `.gpx`. C'est la voie la plus fiable.
- **Strava** : si la séance y est synchronisée, export GPX depuis la page de l'activité.
- Sinon : **Komoot**, **Visorando**, **Openrunner** téléchargent directement du GPX.

Dans la fiche rando, le champ *Trace GPX* accepte ces fichiers. L'app calcule la distance et le dénivelé
positif (lissé à 4 m pour absorber le bruit GPS), dessine le tracé et ne conserve que ~140 points —
quelques kilo-octets, aucun impact sur le quota Firestore.

Les liens Plans (`maps.apple.com`), Komoot, Strava, AllTrails, IGN sont reconnus automatiquement et
affichés avec le nom de leur source.

---

## 12. Idées pour la suite

- Liste de courses partagée qui se vide à chaque séjour
- Météo Vallouise + état d'ouverture des routes (Pré de Mme Carle, col du Lautaret) via une API
- Export du calendrier en `.ics` pour l'agenda du téléphone
- Notification quand quelqu'un réserve des dates
- Carte des randos et des bons plans avec fond IGN
