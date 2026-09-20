// dashboardicons.com's own category tags are missing for many of the most common self-hosted
// apps (Jellyfin, Sonarr, Portainer, Nextcloud, etc. all come back with no categories at all), so
// they're not enough on their own to usefully sort a homelab's Pangolin resources. This is a
// small curated keyword table for the app families that show up most often in that setting.
const RULES = [
  { category: "Media Servers", keywords: ["jellyfin", "plex", "emby", "kodi"] },
  {
    category: "Media Management",
    keywords: ["sonarr", "radarr", "lidarr", "prowlarr", "bazarr", "readarr", "whisparr", "overseerr", "ombi", "jellyseerr", "tautulli", "requestrr"],
  },
  { category: "Download Clients", keywords: ["qbittorrent", "transmission", "deluge", "sabnzbd", "nzbget", "rutorrent", "aria2"] },
  { category: "Photos", keywords: ["immich", "photoprism", "piwigo", "lychee"] },
  { category: "File Storage & Sync", keywords: ["nextcloud", "owncloud", "seafile", "syncthing", "filebrowser", "filerun"] },
  { category: "Documents & Notes", keywords: ["paperless", "bookstack", "joplin", "outline", "wikijs", "notea", "memos"] },
  {
    category: "Monitoring",
    keywords: ["grafana", "prometheus", "uptimekuma", "beszel", "netdata", "glances", "healthchecks", "statuspage", "gatus"],
  },
  { category: "Container Management", keywords: ["portainer", "dockge", "yacht", "watchtower", "dozzle"] },
  {
    category: "Networking",
    keywords: ["pihole", "adguard", "wireguard", "tailscale", "nginxproxymanager", "traefik", "pfsense", "opnsense", "unifi", "openvpn"],
  },
  { category: "Security", keywords: ["vaultwarden", "bitwarden", "authelia", "authentik", "keycloak", "vault"] },
  { category: "Home Automation", keywords: ["homeassistant", "esphome", "zigbee2mqtt", "nodered"] },
  { category: "Development", keywords: ["gitea", "gitlab", "forgejo", "jenkins", "drone", "sonarqube"] },
  { category: "Databases", keywords: ["postgres", "mysql", "mariadb", "mongodb", "redis", "pgadmin", "phpmyadmin", "adminer"] },
  { category: "Communication", keywords: ["matrix", "rocketchat", "mattermost", "synapse"] },
  { category: "Dashboards", keywords: ["homepage", "homarr", "heimdall", "organizr", "flame", "glance", "dashy"] },
];

function normalizeForMatch(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function guessHomelabCategory(name) {
  const key = normalizeForMatch(name);
  if (!key) return null;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => key.includes(kw))) return rule.category;
  }
  return null;
}
