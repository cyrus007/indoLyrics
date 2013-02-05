/**************************************************************************
*   Amarok 2 lyrics script to fetch lyrics from giitaayan.org             *
*                                                                         *
*   Copyright                                                             *
*   (C) 2011 Swapan Sarkar <swapan@yahoo.com>                             *
*                                                                         *
*   This program is free software; you can redistribute it and/or modify  *
*   it under the terms of the GNU General Public License as published by  *
*   the Free Software Foundation; either version 2 of the License, or     *
*   (at your option) any later version.                                   *
*                                                                         *
*   This program is distributed in the hope that it will be useful,       *
*   but WITHOUT ANY WARRANTY; without even the implied warranty of        *
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         *
*   GNU General Public License for more details.                          *
*                                                                         *
*   You should have received a copy of the GNU General Public License     *
*   along with this program; if not, write to the                         *
*   Free Software Foundation, Inc.,                                       *
*   51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.         *
**************************************************************************/

Importer.loadQtBinding( "qt.core" );
Importer.loadQtBinding( "qt.xml" );

/* GLOBAL VARIABLES */
// template for the html object that will be populated and passed to Amarok.Lyrics.showLyricsHtml()
HTML = "<!DOCTYPE html><html><head><title>{TITLE}</title></head><body style=\"color:#000\">{body}</body></html>";
BODY = "<table width=80% border=\"0\" cellpadding=\"3\"> <tr><td width=50\%>Song: {title} </td><td width=30\%>From: {album} </td><td> {year} </td></tr> <tr><td>Music Director: {composer} </td><td colspan=2>Lyrics: {lyricist}</td></tr> <tr><td colspan=3>Singers: {singer} </td></tr> </table><hr/><p> {lyrics} </p><br/><div style=\"margin-left:1em\">{links}</div>";
// if we change variable html it will not reinitialized on next lyrics request, so we will get lyrics from previous song
// because of that we need temp variable
NEWHTML = "";
// URLs to search first
SEARCHURL = "http://localhost/itrans/seek?";
NOTAURL = "http://localhost/lily/seek?";
// maximum numbers that we can follow by #REDIRECT [[Band:Song]]
MAXREDIRECTS = 3;
// urlified title will be here after initialization
TITLE  = "";
// the error message that is displayed if no lyrics were found or there was an error while trying to fetch them
ERRORMSG = "Lyrics not found. Sorry.";

/* receives a Wiki page (in XML format) using wikimedia API and extracts lyrics from it */
function onLyricsReceived( response, redirects )
{
    try
    {
        if( response.length > 0 )
        {
            var doc = new QDomDocument();
            doc.setContent(response);
              
            var title  = doc.elementsByTagName( "title" ).at( 0 ).toElement().text();
            var album  = doc.elementsByTagName( "film" ).at( 0 ).toElement().text();
            var year   = doc.elementsByTagName( "year" ).at( 0 ).toElement().text();
            var singer = doc.elementsByTagName( "singer" ).at( 0 ).toElement().text();
            var composer = doc.elementsByTagName( "composer" ).at( 0 ).toElement().text();
            var lyricist = doc.elementsByTagName( "lyricist" ).at( 0 ).toElement().text();
            var lyrics = doc.elementsByTagName( "lyrics" ).at( 0 ).toElement().text();
            NEWHTML = HTML.replace( "{body}", BODY );
            NEWHTML = NEWHTML.replace( "{title}", Amarok.Lyrics.escape( title ) );
            NEWHTML = NEWHTML.replace( "{album}", Amarok.Lyrics.escape( album ) );
            if( year.length > 0 )
                NEWHTML = NEWHTML.replace( "{year}", "@ " + Amarok.Lyrics.escape( year ) );
            else {
                NEWHTML = NEWHTML.replace( "{year}", " " );
            }
            NEWHTML = NEWHTML.replace( "{composer}", Amarok.Lyrics.escape( composer ) );
            NEWHTML = NEWHTML.replace( "{singer}", Amarok.Lyrics.escape( singer ) );
            NEWHTML = NEWHTML.replace( "{lyricist}", Amarok.Lyrics.escape( lyricist ) );
        
            lyrics = lyrics.replace( /\n/g, "<br />" );   //replace newlines with line breaks
            NEWHTML = NEWHTML.replace( "{lyrics}", Amarok.Lyrics.escape( lyrics ) );
            Amarok.alert( NEWHTML );
            Amarok.Lyrics.showLyricsHtml( NEWHTML );
        }
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( ERRORMSG );
        Amarok.debug( "script error in function onLyricsReceived: " + err );
    }
}

function onLyricsSearchResult( response, redirects )
{
    ITRANSURL = "http://localhost/itrans/";
    try
    {
        if( response.length == 0 )
            Amarok.Lyrics.showLyricsError( "Unable to contact server - no website returned" ); // TODO: this should be i18n able
        else
        {
            Amarok.alert( response );
            if(capture = /#redirect\s+\[\[(.+)\]\]/i.exec(response))
            { // redirect pragma found: #REDIRECT [[Band:Song]]
                redirects++;
                if(redirects == MAXREDIRECTS)
                { // redirection limit exceed
                    Amarok.Lyrics.showLyricsNotFound( ERRORMSG );
                    return;
                }
                var url = QUrl.fromEncoded( new QByteArray( SEARCHURL + encodeURIComponent( capture[1] ) ), 1);
                new Downloader( url, new Function("response", "onLyricsSearchResult(response, " + redirects + ")") );
            }
            else
            {
                var url = QUrl.fromEncoded( new QByteArray( ITRANSURL + response.replace(/[\n\r\t]/g, "") + ".xml" ), 1);
                //Amarok.alert( "request URL: " + url.toString() );
                new Downloader( url, new Function("response", "onLyricsReceived(response, -1)") );
            }
        }
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( ERRORMSG );
        Amarok.debug( "script error in function onLyricsSearchResult: " + err );
    }
}

function onNotationResult( response, redirects )
{
    try
    {
        Amarok.alert( "inside onNotationResult" );
    }
    catch( err )
    {
        Amarok.Lyrics.showLyricsError( "Music Notation not found" );
        Amarok.debug( "script error in function onNotationResult: " + err );
    }
}

// convert all HTML entities to their applicable characters
function entityDecode(string)
{
    try
    {
        var convertxml = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?><body><entity>" + string + "</entity></body>";
        var doc = new QDomDocument();
        if(doc.setContent(convertxml))
        { // xml is valid
            return doc.elementsByTagName( "entity" ).at( 0 ).toElement().text();
        }
        return string;
    }
    catch( err ) { Amarok.debug( "script error in function entityDecode: " + err ); }
}

// entry point
function getLyrics( artist, title, url )
{
    try
    {
        //URLify artist and title
        //ARTIST = artist = URLify( entityDecode(artist) );
        TITLE = title = entityDecode(title);
        HTML = HTML.replace( "{TITLE}", TITLE );
        var genre = Amarok.Engine.currentTrack().genre.replace(/[\r\t\n]/g, "");
        //Amarok.alert( "Genre: " + genre );
        if(genre.toUpperCase().substring(0, 5) == "HINDI")
        {
                var url = QUrl.fromEncoded( new QByteArray( SEARCHURL + encodeURIComponent(title) ), 1);
                new Downloader( url, new Function("response", "onLyricsSearchResult(response, -1)") );
        }
        else if(genre.toUpperCase().substring(0, 12) == "INSTRUMENTAL")
        {
                title = encodeURIComponent( title );
                var url = QUrl.fromEncoded( new QByteArray( NOTAURL + encodeURIComponent(title) ), 1);
                new Downloader( url, new Function("response", "onNotationResult(response, -1)") );
        }
    }
    catch( err ) { Amarok.debug( "error: " + err ); }
}

Amarok.Lyrics.fetchLyrics.connect( getLyrics );
