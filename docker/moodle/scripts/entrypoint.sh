#!/bin/sh
set -eu
chown www-data:www-data /var/moodledata
if [ ! -f /var/moodledata/.edumonitor-installed ]; then
    runuser -u www-data -- php /opt/edumonitor/install.php
    touch /var/moodledata/.edumonitor-installed
    chown www-data:www-data /var/moodledata/.edumonitor-installed
fi
php /opt/edumonitor/provision.php
chown -R www-data:www-data /var/moodledata
exec "$@"
