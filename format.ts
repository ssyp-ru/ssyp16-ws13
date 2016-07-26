import * as Common from './common';
import * as Moment from 'moment';

export let onelineFormat = "%Cyellow%h%Creset %s";
export let onelineWideFormat = "%Cyellow%h%Creset %Cgreen(%an, %ar)%Creset %s";
export let shortFormat = "commit %Cyellow%h%Creset%nAuthor: %Cgreen%an%Creset%n%s";
export let mediumFormat = "commit %Cyellow%H%Creset%nAuthor: %Cgreen%an%Creset%nDate: %ad%n%b";
export let fullFormat = "commit %Cyellow%H%Creset%nAuthor: %Cgreen%an%Creset%nCommit: %Cgreen%cn%Creset%n%b";
export let fullerFormat = "commit %Cyellow%H%Creset%nAuthor: %Cgreen%an%Creset%nAuthorDate: %ad%nCommit: %Cgreen%cn%Creset%nCommitDate: %cd%n%b";

let colorCodes = {
    black: 30,
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,

    reset: 39,

    gray: 90,
    grey: 90
}

export function formatCommitMessage(commit: Common.Commit, format: string): string {
    var message = "";
    var special = false;
    for (var i = 0; i < format.length; i++) {
        var c = format[i];
        if (c !== '%' && !special) {
            message += c;
            continue;
        } else if (c !== '%' && special) {
            switch (c) {
                case 'C': {
                    // Color

                    function isNext(str: string): boolean {
                        if (format.length - (i + 1) < str.length) return false;
                        var strI = 0;
                        for (var j = i + 1; j < format.length; j++) {
                            if (format[j] != str[strI++]) return false;
                            if (strI >= str.length) break;
                        }
                        i += str.length;
                        return true;
                    }

                    function next() {
                        for (var k of Object.keys(colorCodes))
                            if (isNext(k))
                                return k;
                    }

                    message += `\u001b[${colorCodes[next()]}m`;
                    break;
                }
                case 'H': {
                    // SHA
                    message += commit.id;
                    break;
                }
                case 'h': {
                    // SHA
                    message += commit.id.substring(0, 7);
                    break;
                }
                case 's': {
                    // Title
                    message += commit.message.split('\n').shift();
                    break;
                }
                case 'b': {
                    // Body
                    message += commit.message;
                    break;
                }
                case 'a':
                case 'c': {
                    // Author and Committer
                    if (format[i + 1] == 'd') {
                        message += Moment(new Date(commit.time)).format('DD-MM-YYYY HH:MM:SS');
                    } else if (format[i + 1] == 'n') {
                        message += commit.authorName;
                    } else if (format[i + 1] == 'e') {
                        message += commit.authorEMail;
                    } else if (format[i + 1] == 'r') {
                        message += Moment(new Date(commit.time)).fromNow();
                    }
                    i++;
                    break;
                }
                case 'n': {
                    // New line
                    message += '\n';
                    break;
                }
                case '%': {
                    // %
                    message += '%';
                    break;
                }
            }
            special = false;
            continue;
        }
        special = true;
    }
    return message;
}