/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Certificate Watch.
 *
 * The Initial Developer of the Original Code is
 * Simos Xenitellis.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

var sqliteStrings = 
{
  // CertWatchDB.sqlite initialisation strings
  var dbTableVersionCreate = "CREATE TABLE version (version INT)";
  var dbTableVersionInsert = "INSERT INTO version (version) VALUES (1)";
  var dbTableCertificatesRoot = ""+<r><![CDATA[
              CREATE TABLE certificatesRoot (
              hashCertificate TEXT PRIMARY KEY not NULL,
              derCertificate TEXT not NULL,
              commonNameRoot TEXT not NULL,
              organizationalUnitRoot TEXT not NULL,
              dateAddedToCertWatch DATE default CURRENT_TIMESTAMP,
              dateRemovedFromMozilla DATE default NULL,
              dateReAddedToMozilla DATE default NULL,
              dateFirstUsed DATE default NULL,
              dateLastUsed DATE default NULL,
              countTimesUsed INTEGER default '0')
                       ]]></r>;
  var dbTableCertificatesWebsite = ""+<r><![CDATA[
          CREATE TABLE certificatesWebsite (
              hashCertificate TEXT PRIMARY KEY not NULL,
              derCertificate TEXT not NULL,
              commonNameWebsite TEXT not NULL,
              dateFirstVisit DATE default CURRENT_TIMESTAMP,
              dateLastVisit DATE default CURRENT_TIMESTAMP,
              countTimesVisited INTEGER default '1')
                      ]]></r>;
  var dbTableVisitsWebsite = ""+<r><![CDATA[
          CREATE TABLE visitsWebsite (
              commonNameWebsite TEXT not NULL,
              hashCertificate TEXT not NULL,
              dateVisit DATE default CURRENT_TIMESTAMP,
              urlPage TEXT not NULL,
              urlReferer TEXT default NULL)
                      ]]></r>;

  // Prepared SQLite statement strings
  var dbSelectStringCertificatesRoot =
      "SELECT * FROM certificatesRoot";
  var dbSelectStringCertificatesRootHash =
      "SELECT * FROM certificatesRoot WHERE hashCertificate=:hash";
  var dbSelectStringCertificatesWebsiteHash =
      "SELECT * FROM certificatesWebsite WHERE hashCertificate=:hash";
  var dbSelectStringCertificatesWebsiteCommonName =
      "SELECT * FROM certificatesWebsite WHERE commonNameWebsite=:cn";
  var dbSelectStringVisitsCommonName =
      "SELECT * FROM visitsWebsite WHERE commonNameWebsite=:cn";
  var dbSelectStringVisitsHash =
      "SELECT * FROM visitsWebsite WHERE hashCertificate=:hash";

  var dbInsertStringCertificatesRoot = ""+<r><![CDATA[
      INSERT INTO certificatesRoot (hashCertificate,
                                    derCertificate,
                                    commonNameRoot,
                                    organizationalUnitRoot,
                                    dateAddedToCertWatch)
       VALUES (?1, ?2, ?3, ?4, ?5)
                                    ]]></r>;
  var dbInsertStringCertificatesWebsite = ""+<r><![CDATA[
      INSERT INTO certificatesWebsite (hashCertificate,
                                       derCertificate,
                                       commonNameWebsite,
                                       dateFirstVisit,
                                       dateLastVisit,
                                       countTimesVisited)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                                    ]]></r>;
  var dbInsertStringVisits = ""+<r><![CDATA[
      INSERT INTO visitsWebsite (commonNameWebsite,
                                 hashCertificate,
                                 dateVisit,
                                 urlPage,
                                 urlReferer)
      VALUES (?1, ?2, ?3, ?4, ?5)
                                 ]]></r>;

  var dbUpdateStringCertificatesRootRemoved = ""+<r><![CDATA[
      UPDATE certificatesRoot SET
                                 dateRemovedFromMozilla=:dateRemovedFromMozilla
      WHERE hashCertificate=:hashCertificate
                                 ]]></r>;
  var dbUpdateStringCertificatesRootReAdded = ""+<r><![CDATA[
      UPDATE certificatesRoot SET
                                 dateReAddedToMozilla=:dateReAddedToMozilla
      WHERE hashCertificate=:hashCertificate
                                 ]]></r>;
  var dbUpdateStringCertificatesRootWeb = ""+<r><![CDATA[
      UPDATE certificatesRoot SET
                                 dateFirstUsed=:dateFirstUsed,
                                 dateLastUsed=:dateLastUsed,
                                 countTimesUsed=:countTimesUsed
      WHERE hashCertificate=:hashCertificate
                                 ]]></r>;
  var dbUpdateStringCertificatesWebsites = ""+<r><![CDATA[
      UPDATE certificatesWebsite SET
                                    dateFirstVisit=:dateFirstVisit,
                                    dateLastVisit=:dateLastVisit,
                                    countTimesVisited=:countTimesVisited
      WHERE hashCertificate=:hashCertificate;
                                    ]]></r>;
};