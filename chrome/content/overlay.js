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

var Cc = Components.classes;
var Ci = Components.interfaces;

var CertWatch =
{
  // Initialises the object, by initialising the DB structures
  // and updating the root certificate store in the SQLite database.
  onLoad: function()
  {
    // initialization code
    this.initialized = true;
    this.bundle = document.getElementById("certwatch-strings");

    // Perform a one-off initialisation of the database file (SQLite).
    // Also, initialise the prepared SQLite statements.
    this.dbinit();

    // Creates the initial storage of the browser root certificates, or
    // compares the current set of browser root certificates with those stored.
    this.updateRootCertificates();

    // Add event listener for "DOMContentLoaded".
    var content = document.getElementById("content");
    content.addEventListener("DOMContentLoaded", this.onPageLoad, true);
  },

  // Provides the menu item under Tools.
  onMenuItemCommand: function(e)
  {
    window.openDialog("chrome://certwatch/content/options.xul",
                      "Preferences",
                      "chrome,titlebar,toolbar,centerscreen,modal").focus();
  },

  // Perform a one-off initialisation of the database file (SQLite).
  // Also, initialise the prepared SQLite statements.
  dbinit: function()
  {
    try
    {
      var dbFile = Cc["@mozilla.org/file/directory_service;1"]
                     .getService(Ci.nsIProperties)
                     .get("ProfD", Ci.nsIFile);
      var dbFilePrevious = Cc["@mozilla.org/file/directory_service;1"]
                     .getService(Ci.nsIProperties)
                     .get("ProfD", Ci.nsIFile);
      var storage = Cc["@mozilla.org/storage/service;1"]
                    .getService(Ci.mozIStorageService);
      dbFile.append("CertWatchDB3.sqlite");
      dbFilePrevious.append("CertWatchDB2.sqlite");

      // Does '.../CertWatchDB.sqlite' exist?
      var dbExists = dbFile.exists();

      if (!dbExists && dbFilePrevious.exists())
      {
          // FIXME: Add function that migrates older database files to newer database format.
          var params = { none: null };

          window.openDialog("chrome://certwatch/content/dialog-db-migration.xul", "certwatch-db-migration",
                    "chrome,dialog,modal", params);
      }

      // Open a handle to CertWatchDB.sqlite
      this.dbHandle = storage.openDatabase(dbFile);

      // CertWatchDB.sqlite first-time table creation
      if (! !!dbExists)
      {
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVersionCreate);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVersionInsert);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesRoot);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableCertificatesWebsite);
        this.dbHandle.executeSimpleSQL(sqliteStrings.dbTableVisitsWebsite);
      }

      // Create SQLite prepared statements
      this.dbSelectCertsRoot =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesRoot);
      this.dbSelectCertsRootHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesRootHash);
      this.dbSelectCertsWebsiteHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesWebsiteHash);
      this.dbSelectCertsWebsiteCommonName =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringCertificatesWebsiteCommonName);
      this.dbSelectVisitsCommonName =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringVisitsCommonName);
      this.dbSelectVisitsHash =
          this.dbHandle.createStatement(sqliteStrings.dbSelectStringVisitsHash);
      this.dbInsertCertsRoot =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificates);
      this.dbInsertCertsWebsite =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringCertificatesWebsite);
      this.dbInsertVisits =
          this.dbHandle.createStatement(sqliteStrings.dbInsertStringVisits);
      this.dbUpdateCertsRootRemoved =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootRemoved);
      this.dbUpdateCertsRootReAdded =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootReAdded);
      this.dbUpdateCertsRootWeb =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesRootWeb);
      this.dbUpdateCertsIntermediateWeb =
        this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesIntermediate);
      this.dbUpdateCertsWebsite =
          this.dbHandle.createStatement(sqliteStrings.dbUpdateStringCertificatesWebsites);
    }
    catch(err)
    {
      throw new Error("CertWatch: Error initializing SQLite prepared statements: " +
          err + " SQLite error »" + this.dbHandle.lastErrorString + " file: " +
          dbFile.path);
      backupDatabaseFile(dbFile);
    }

    if (!dbExists)
    {
      this.populateCertWatchDB();
    }
  },

  // Populates CertWatchDB.sqlite with browser's certificate store.
  // It is only invoked when Firefox runs for the first time with the CertWatch extension.
  // These are either root certificates or intermediate certificates.
  // In addition, Firefox adds (without notifying) intermediate certificates in the certificate store.
  // We save each type of certificates to the CertWatchDB.sqlite database file.
  // FIXME: This function takes long (about 10 seconds) to complete. Find a way to fix, like give feedback to user.
  populateCertWatchDB: function()
  {
    var enumCertificateStore = CertWatchHelpers.getFirefoxCertificateStoreEnumerator();
    var countRootCerts = 0;
    var countIntermediateCerts = 0;

    var hashes = new Array();

    try
    {
      // For each root certificate found in Firefox,
      while (enumCertificateStore.hasMoreElements())
      {
        var thisElement = enumCertificateStore.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);

        var certArray = thisCertificate.getChain();
        var certEnumerator = certArray.enumerate();

        while (certEnumerator.hasMoreElements())
        {
          var thisCert = certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert);
          var hashCert = thisCert.sha1Fingerprint;

          if (hashes[hashCert] == undefined)
          {
              var rawDER = thisCert.getRawDER({});
              var base64DER = Base64.encode(rawDER);

              hashes[hashCert] = true;

              var now = Date();

              this.dbInsertCertsRoot.bindUTF8StringParameter(0, // "hashCertificate"
                                                             hashCert);
              this.dbInsertCertsRoot.bindUTF8StringParameter(1, // "derCertificate"
                                                             base64DER);
              this.dbInsertCertsRoot.bindUTF8StringParameter(2, // "commonName"
                                                             thisCert.commonName);
              this.dbInsertCertsRoot.bindUTF8StringParameter(3, // "organization"
                                                             thisCert.organization);
              this.dbInsertCertsRoot.bindUTF8StringParameter(4, // "dateAddedToCertWatch"
                                                             now);
              this.dbInsertCertsRoot.bindUTF8StringParameter(5, // "hashParent"
                                                             CertWatchHelpers.getParentHash(thisCert));

              this.dbInsertCertsRoot.execute();
              this.dbInsertCertsRoot.reset();

              if (CertWatchHelpers.isRootCertificate(thisCert))
              {
                  countRootCerts += 1;
              }
              else
              {
                  countIntermediateCerts += 1;
              }
          }
        }
      }
    }
    catch (err)
    {
        throw new Error("CertWatch: Error adding Firefox certficates at init(): "+ err);
    }
    finally
    {
      this.dbInsertCertsRoot.reset();
    }

    var params = { firefoxRootCertCount: countRootCerts, firefoxIntermediateCertCount: countIntermediateCerts };

    window.openDialog("chrome://certwatch/content/dialog-intro.xul", "certwatch-init",
		      "chrome,dialog,modal", params);
  },

  // Runs when Firefox starts up. Check for changes in the root certificate
  // DB of the browser, and updates accordingly the SQLite DB.
  // Case #
  // 1. If FirefoxDB certificate does not exist in CertWatchDB, add to CertWatchDB.
  // 2. If FirefoxDB certificate exists in CertWatchDB, mark as re-added, if needed.
  // 3. If CertWatchDB certificate does not exist in FirefoxDB, mark as removed in CertWatchDB.
  updateRootCertificates: function()
  {
    var enumRootCertificates = CertWatchHelpers.getFirefoxCertificateStoreEnumerator();

    var certwatchCertificates = new Array();
    var certwatchRemovals = new Array();

    var certificatesNew = new Array();
    var certificatesRemoved = new Array();
    var certificatesReinstated = new Array();

    var counterNew = 0;
    var counterRemoved = 0;
    var counterReinstated = 0;

    var i;

    try
    {
      // Fill in certwatchCertificates[] with the CertWatchDB root/intermediate certificates.
      // Also record the hashes of the CertWatchDB roots that have RemovalDate.
      while (this.dbSelectCertsRoot.executeStep())
      {
        var hashCert = this.dbSelectCertsRoot.getUTF8String(0);
        var removalDate = this.dbSelectCertsRoot.getUTF8String(5);
        var readditionDate = this.dbSelectCertsRoot.getUTF8String(6);
        if (!!removalDate)
        {
          certwatchRemovals[hashCert] =
                                        {
                                          removed: removalDate,
                                          readded: readditionDate
                                        };
        }

        certwatchCertificates[hashCert] = true;
      }

      // For each certificate found in Firefox's root/intermediate certificate store,
      while (enumRootCertificates.hasMoreElements())
      {
        var thisElement = enumRootCertificates.getNext();
        var thisCertificate = thisElement.QueryInterface(Ci.nsIX509Cert);
        var rawDER = thisCertificate.getRawDER({});
        var hashCert = thisCertificate.sha1Fingerprint;
        var base64DER = Base64.encode(rawDER);
        var now = Date();

        // If a new Firefox root certificate was found (due to browser update?),
        if (certwatchCertificates[hashCert] == undefined)     //         Case 1
        {
          this.dbInsertCertsRoot.bindUTF8StringParameter(0,  // "hashCertificate"
                  hashCert);
          this.dbInsertCertsRoot.bindUTF8StringParameter(1,  // "derCertificate"
                  Base64.encode(rawDER));
          this.dbInsertCertsRoot.bindUTF8StringParameter(2,  // "commonName"
                  thisCertificate.commonName);
          this.dbInsertCertsRoot.bindUTF8StringParameter(3,  // "organization"
                  thisCertificate.organization);
          this.dbInsertCertsRoot.bindUTF8StringParameter(4,  // "dateAddedToCertWatch"
                  now);
          this.dbInsertCertsRoot.bindUTF8StringParameter(5,  // "hashParent"
                  CertWatchHelpers.getParentHash(thisCertificate));

          this.dbInsertCertsRoot.execute();

          certificatesNew[counterNew] = {
                                            params:
                                            {
                                              cert: thisCertificate,
                                              validity: thisCertificate.validity.QueryInterface(Ci.nsIX509CertValidity),
                                              hashParent: CertWatchHelpers.getParentHash(thisCertificate),
                                              currentCert: -1,
                                              totalCerts: -1
                                            },
                                            paramsOut:
                                            {
                                                clickedAccept: false,
                                                clickedCancel: false
                                            }
                                        };
          counterNew++;
        }
        else // else both CertWatchDB and Firefox have this root certificate,
        {
          //  RemovedDate(RD) ReAddedDate (RAD)                        Case 2
          // a     .              .       -> Do nothing.
          // b     x              .       -> Set ReAddedDate.
          // c     .              x       -> Should not happen.
          // d     x              x       -> If RAD<RD, Set ReAddedDate.
          if (certwatchRemovals[hashCert]) // If the RemovedDate has been set,
          {
            if ((!certwatchRemovals[hashCert].readded &&
                  !!certwatchRemovals[hashCert].removed) ||   // If case [b] or
                  CertWatchHelpers.dateToTime(certwatchRemovals[hashCert].removed) >
                    CertWatchHelpers.dateToTime(certwatchRemovals[hashCert].readded)) // case [d],
            {
              this.dbUpdateCertsRootReAdded.params.hashCertificate = hashCert;
              this.dbUpdateCertsRootReAdded.params.dateReAddedToMozilla = now;

              this.dbUpdateCertsRootReAdded.execute();

              this.dbUpdateCertsRootReAdded.reset();

              certificatesReinstated[counterReinstated] = {
                      params:
                      {
                        cert: thisCertificate,
                        validity: thisCertificate.validity.QueryInterface(Ci.nsIX509CertValidity),
                        hashParent: CertWatchHelpers.getParentHash(thisCertificate),
                        currentCert: -1,
                        totalCerts: -1
                      },
                      paramsOut:
                      {
                          clickedAccept: false,
                          clickedCancel: false
                      }
                  };
              counterReinstated++;
            }
          }

          // Delete the reference from certwatchCertificates.
          delete certwatchCertificates[hashCert];
        }
      }

      // 'certwatchCertificates' now has those remaining CertWatchDB certificates
      //                                         that are missing from Firefox.
      for (hash in certwatchCertificates)
      {
        //   RemovedDate-RD     ReAddedDate-RAD                  Case 3 Matrix
        // a      .                .       -> Set RemovedDate.
        // b      x                .       -> Do nothing.
        // c      .                x       -> Should not happen.
        // d      x                x       -> If RAD > RD, Set RemovedDate.
        if (!certwatchRemovals[hash] ||   // case [a]
            CertWatchHelpers.dateToTime(certwatchRemovals[hash].readded) >
              CertWatchHelpers.dateToTime(certwatchRemovals[hash].removed)) // case [d]
          {
            this.dbUpdateCertsRootRemoved.params.hashCertificate = hash;
            this.dbUpdateCertsRootRemoved.params.dateRemovedFromMozilla = now;

            this.dbUpdateCertsRootRemoved.execute();

            this.dbUpdateCertsRootRemoved.reset();

            /* Prepare to search for hashCert cert in CertWatchDB */
            this.dbSelectCertsRootHash.params.hash = hash;

            if (this.dbSelectCertsRootHash.executeStep())
            {
              var removedCertBase64 = this.dbSelectCertsRootHash.getUTF8String(1);
              var removedCertificate = CertWatchHelpers.convertBase64CertToX509(removedCertBase64);

              certificatesRemoved[counterRemoved] = {
                      params:
                      {
                        cert: removedCertificate,
                        validity: removedCertificate.validity.QueryInterface(Ci.nsIX509CertValidity),
                        hashParent: CertWatchHelpers.getParentHash(removedCertificate),
                        currentCert: -1,
                        totalCerts: -1
                      },
                      paramsOut:
                      {
                          clickedAccept: false,
                          clickedCancel: false
                      }
                  };
              counterRemoved++;
            }

            this.dbSelectCertsRootHash.reset();
          }
      }

      for (i = 0; i < certificatesNew.length; i++)
      {
          certificatesNew[i].params.currentCert = i+1;
          certificatesNew[i].params.totalCerts = certificatesNew.length;

          // Inform that a new root certificate was found in Firefox,
          window.openDialog("chrome://certwatch/content/dialog-new-root-cert.xul",
                            "certwatch-new-root-cert",
                            "chrome,dialog,modal", certificatesNew[i].params, certificatesNew[i].paramsOut);
      }

      for (i = 0; i < certificatesRemoved.length; i++)
      {
          certificatesRemoved[i].params.currentCert = i+1;
          certificatesRemoved[i].params.totalCerts = certificatesRemoved.length;

          // Inform that a root certificate was removed from Firefox,
          window.openDialog("chrome://certwatch/content/dialog-removed-root-cert.xul",
                  "certwatch-removed-root-cert",
                  "chrome,dialog,modal", certificatesRemoved[i].params, certificatesRemoved[i].paramsOut);
      }

      for (i = 0; i < certificatesReinstated.length; i++)
      {
          certificatesReinstated[i].params.currentCert = i+1;
          certificatesReinstated[i].params.totalCerts = certificatesReinstated.length;

          // Inform that a new root certificate was found in Firefox,
          window.openDialog("chrome://certwatch/content/dialog-reinstated-root-cert.xul",
                  "certwatch-reinstated-root-cert",
                  "chrome,dialog,modal", certificatesReinstated[i].params, certificatesReinstated[i].paramsOut);
      }
    }
    catch (err)
    {
      throw new Error("CertWatch: Error updating root certificates: "+ err);
    }
    finally
    {
      this.dbSelectCertsRoot.reset();
      // Reset is already invoked earlier.
      // this.dbSelectCertsRootHash.reset();
      // this.dbUpdateCertsRootRemoved.reset();
    }
  },

  // Invoked through the "DOMContentLoaded" event.
  onPageLoad: function(aEvent)
  {
    var doc = aEvent.originalTarget;
    if (doc.location.protocol == "https:")
    {
      CertWatch.onSecurePageLoad(doc);
    }
  },

  // Invoked when an https page is loaded.
  // We use the same way now as Certificate Patrol does.
  // TODO: Investigate whether to hook into the SSL/TLS component of NSS.
  //       During tests, hooking to NSS brings about six hits per https
  //       document loaded. (possibly due to not pipelining?)
  // TODO: If the user switches tabs too quickly, this method has the side-effect
  //       of recording the wrong page details. A bit rare; needs investigation.
  onSecurePageLoad: function(doc)
  {
    var serverCert;
    var validity;

    // Finds the right tab that issues the SecurePageLoad event.
    // We then load the corresponding securityUI for this event.
    var browser = gBrowser.getBrowserForDocument(doc);
    if (!browser)
      return

    var securityUI = browser.securityUI;
    if (!securityUI)
      return;

    var sslStatusProvider = securityUI.QueryInterface(Ci.nsISSLStatusProvider);
    if (!sslStatusProvider)
      return;

    var sslStatus = sslStatusProvider.SSLStatus;
    if (!sslStatus)
      return;

    var sslStatusStruct = sslStatus.QueryInterface(Ci.nsISSLStatus);
    if (!sslStatusStruct)
      return;

    serverCert = sslStatusStruct.serverCert;
    if (!serverCert)
      return;

    validity = serverCert.validity.QueryInterface(Ci.nsIX509CertValidity);
    if (!validity)
      return;

    var URL = gBrowser.contentDocument.URL;
    var REFERRER = gBrowser.contentDocument.referrer;

    var certArray = serverCert.getChain();
    var certEnumerator = certArray.enumerate();
    var chainCerts = new Array();
    var countCertificates = 0;

    while (certEnumerator.hasMoreElements())
    {
      chainCerts[countCertificates] = { cert: certEnumerator.getNext().QueryInterface(Ci.nsIX509Cert),
                                        timesAccessed: -1,
                                        mustShow: false };
      countCertificates++;
    }

    var rawDER, hashCert, base64DER;
    var rawDERParent, hashCertParent, base64DERParent;
    var count = 0;
    var i;

    var cert = chainCerts[0].cert;
    hashCert = chainCerts[0].cert.sha1Fingerprint;
    rawDER = chainCerts[0].cert.getRawDER({});
    base64DER = CertWatchHelpers.convertDERtoBase64(rawDER);
    if (countCertificates > 1)
        hashCertParent = chainCerts[0].cert.sha1Fingerprint;
    else
        hashCertParent = "";

    chainCerts[0].timesAccessed = this.doWebsiteCertificateWasAccessed(hashCert,
                                                                       cert,
                                                                       base64DER,
                                                                       URL,
                                                                       hashCertParent);
    chainCerts[0].mustShow = CertWatchHelpers.checkIfShowWebsiteCertDialog(chainCerts[0].timesAccessed);

    this.doAddWebsiteVisit(hashCert,
                           chainCerts[0].cert.commonName,
                           URL,
                           REFERRER);

    // Deal with the intermediate(s) and finally the root certificate.
    for (i = 1; i < countCertificates; i++)
    {
      rawDER = chainCerts[i].cert.getRawDER({});
      hashCert = chainCerts[i].cert.sha1Fingerprint;
      base64DER = CertWatchHelpers.convertDERtoBase64(rawDER);
      if (i + 1 < countCertificates)
        hashCertParent = chainCerts[i+1].cert.sha1Fingerprint;
      else
        hashCertParent = null;

      chainCerts[i].timesAccessed = this.doRootCertificateWasAccessed(hashCert,
                                                                      base64DER,
                                                                      chainCerts[i].cert,
                                                                      gBrowser.contentDocument.URL,
                                                                      hashCertParent);
      if (i + 1 == countCertificates)
          chainCerts[i].mustShow = CertWatchHelpers.checkIfShowRootCertDialog(chainCerts[i].timesAccessed);
      else
          chainCerts[i].mustShow = CertWatchHelpers.checkIfShowIntermediateCertDialog(chainCerts[i].timesAccessed);
    }

    var params = {
                   chainCerts: chainCerts,
                   URL: gBrowser.contentDocument.URL
                 };
    var paramsOut =
                    {
                      clickedAccept: false,
                      clickedCancel: false
                    };

    for (i = 1; i < countCertificates; i++)
    {
        if ( chainCerts[i].mustShow )
        {
            window.openDialog("chrome://certwatch/content/dialog-certificate-access.xul",
               "certwatch-certificate-access",
               "chrome,dialog,modal", params, paramsOut);
            break;
        }
    }
  },

  // (from 'intermediate()' variant).
  // Case: the user visited a secure website which references root cert 'hashCert'.
  //    Caveat A: We assume root cert exists in browser root cert collection.
  // 1. Search root certs (in SQLite DB) for hashCert. Cache the results
  // 2. Update the rootCert data for said certificate.
  //    dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //    dateLastUsed -> current timedate.
  //    countTimesUsed -> +1

  // Case: the user visited a secure website which references root cert 'hashCert'.
  //   	Caveat A: We assume root cert exists in browser root cert collection.
  // 1. Search root certs (in SQLite DB) for hashCert. Cache the results.
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  // The root certificate is the last certificate in the certificate chain.
  doRootCertificateWasAccessed: function(hashCert, base64DER, cert, URL, hashParent)
  {
    var timesAccessed;

    try
    {
      this.dbSelectCertsRootHash.params.hash = hashCert;

      // If known root/intermediate certificate hash,
      if (this.dbSelectCertsRootHash.executeStep())
      {
        var now = Date();

        var storedRootCertFirstUsed  = this.dbSelectCertsRootHash.getUTF8String(7);
        var storedRootCertLastUsed   = this.dbSelectCertsRootHash.getUTF8String(8);
        var storedRootCertTimesUsed  = this.dbSelectCertsRootHash.getInt64(9);
        var storedRootCertFirstNull  = this.dbSelectCertsRootHash.getIsNull(7);
        var storedRootCertParentHash = this.dbSelectCertsRootHash.getUTF8String(10);

        this.dbUpdateCertsRootWeb.params.hashCertificate = hashCert;

        this.dbUpdateCertsRootWeb.params.countTimesUsed = storedRootCertTimesUsed + 1;

        if (storedRootCertFirstNull)
        {
          this.dbUpdateCertsRootWeb.params.dateFirstUsed = now;
        }
        else
        {
          this.dbUpdateCertsRootWeb.params.dateFirstUsed = storedRootCertFirstUsed;
        }
        this.dbUpdateCertsRootWeb.params.dateLastUsed = now;

        this.dbUpdateCertsRootWeb.execute();

        timesAccessed = storedRootCertTimesUsed + 1;
      }
      else if (CertWatchHelpers.isRootCertificate(cert))
      {
          alert("FIXME: Got a new unknown *root* certificate which is not stored in my CertWatchDB. What to do? It is called "
                  + cert.commonName + " with hash " + cert.sha1Fingerprint);

          timesAccessed = 0;
      }
      else  // Else, it is a new certificate (intermediate).
      {
        this.dbInsertCertsRoot.bindUTF8StringParameter(0, hashCert);
        this.dbInsertCertsRoot.bindUTF8StringParameter(1, base64DER);
        this.dbInsertCertsRoot.bindUTF8StringParameter(2, cert.commonName);
        this.dbInsertCertsRoot.bindUTF8StringParameter(3, cert.organization);
        this.dbInsertCertsRoot.bindUTF8StringParameter(4, now);
        this.dbInsertCertsRoot.bindUTF8StringParameter(5, hashParent);

        this.dbInsertCertsRoot.execute();

        timesAccessed = 1;
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doRootCertificateWasAccessed: "+ err);
    }
    finally
    {
      this.dbSelectCertsRootHash.reset();
      this.dbInsertCertsRoot.reset();
      this.dbUpdateCertsRootWeb.reset();
    }

    return timesAccessed;
  },

  // Case: the user visited a secure website with certificate hash 'hashCert'.
  // 1. Search root certs (in SQLite DB) for hashCert. Cache the results
  // 2. Update the rootCert data for said certificate.
  //		dateFirstUsed -> if null, dateFirstUsed = current timedate.
  //		dateLastUsed -> current timedate.
  //		countTimesUsed -> +1
  doWebsiteCertificateWasAccessed: function(hashCert, cert, base64DER, URL, hashParent)
  {
    var timesAccessed;

    try
    {
      var now = Date();

      this.dbSelectCertsWebsiteHash.params.hash = hashCert;

      if (this.dbSelectCertsWebsiteHash.executeStep())
      {
        var storedWebsiteFirstVisit = this.dbSelectCertsWebsiteHash.getUTF8String(3);
        var storedWebsiteLastVisit  = this.dbSelectCertsWebsiteHash.getUTF8String(4);
        var storedWebsiteTimesVisited = this.dbSelectCertsWebsiteHash.getInt64(5);
        var storedWebsiteFirstNull = this.dbSelectCertsWebsiteHash.getIsNull(3);

        this.dbUpdateCertsWebsite.params.hashCertificate = hashCert;

        this.dbUpdateCertsWebsite.params.countTimesVisited = storedWebsiteTimesVisited + 1;
        if (storedWebsiteFirstNull)
        {
          this.dbUpdateCertsWebsite.params.dateFirstVisit = now;
        }
        else
        {
          this.dbUpdateCertsWebsite.params.dateFirstVisit = storedWebsiteFirstVisit;
        }
        this.dbUpdateCertsWebsite.params.dateLastVisit = now;

        this.dbUpdateCertsWebsite.execute();

        timesAccessed = storedWebsiteTimesVisited + 1;
      }
      else
      {
        this.dbInsertCertsWebsite.bindUTF8StringParameter(0, hashCert);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(1, base64DER);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(2, cert.commonName);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(3, now);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(4, now);
        this.dbInsertCertsWebsite.bindInt64Parameter(5, 1);
        this.dbInsertCertsWebsite.bindUTF8StringParameter(6, hashParent);

        this.dbInsertCertsWebsite.execute();

        timesAccessed = 1;
      }
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doWebsiteCertificateWasAccessed: "+ err);
    }
    finally
    {
      this.dbSelectCertsWebsiteHash.reset();
      this.dbInsertCertsWebsite.reset();
      this.dbUpdateCertsWebsite.reset();
    }

    return timesAccessed;
  },

  // Case: the user visited a secure website.
  // 1. Add an entry to Visits table,
  //		canonicalName -> as reported by the certificate.
  //		hashCertificate -> hash of DER of website certificate.
  //		timedate of visit -> `now`.
  //		URL -> full URL of website.
  //		Referer -> referer, if any.
  doAddWebsiteVisit: function(hashCert, CN, URL, REFERER)
  {
    var now = Date();

    try
    {
      this.dbInsertVisits.bindUTF8StringParameter(0, CN);
      this.dbInsertVisits.bindUTF8StringParameter(1, hashCert);
      this.dbInsertVisits.bindUTF8StringParameter(2, now);
      this.dbInsertVisits.bindUTF8StringParameter(3, URL);
      this.dbInsertVisits.bindUTF8StringParameter(4, REFERER);

      this.dbInsertVisits.execute();
    }
    catch(err)
    {
      throw new Error("CertWatch: Error at doAddWebsiteVisit: "+ err);
    }
    finally
    {
      this.dbInsertVisits.reset();
    }
  }
};

window.addEventListener("load", function(e) { CertWatch.onLoad(e); }, false);
