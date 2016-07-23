import * as Common from './common';
import * as Moment from 'moment';
export const onelineFormat = "%Cyellow%h%Creset %s";
export const onelineWideFormat = "%Cyellow%h%Creset %Cgreen(%an, %ar)%Creset %s";
export const shortFormat = "commit %Cyellow%h%Creset%nAuthor: %Cgreen%an%Creset%n%s";
export const mediumFormat = "commit %Cyellow%H%Creset%nAuthor: %Cgreen%an%Creset%nDate: %ad%n%b";
export const fullFormat = "commit %Cyellow%H%Creset%nAuthor: %Cgreen%an%Creset%nCommit: %Cgreen%cn%Creset%n%b";
export const fullerFormat = "commit %Cyellow%H%Creset%nAuthor: %Cgreen%an%Creset%nAuthorDate: %ad%nCommit: %Cgreen%cn%Creset%nCommitDate: %cd%n%b";
export function formatCommitMessage(commit: Common.Commit, format: string): string {
    var message = "";
    var special = false;
    for (var i = 0; i < format.length; i++) {
        var c = format[i];
        if (c !== '%' && !special) {
            message += c;
            continue;
        } else if (c !== '%' && special) {
            if (c == 'C') {
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
                var colorCodes = {
                    black: 30,
                    red: 31,
                    green: 32,
                    yellow: 33,
                    blue: 34,
                    magenta: 35,
                    cyan: 36,
                    white: 37,
                    gray: 90,
                    grey: 90
                }
                if (isNext('reset')) message += '\u001b[' + 39 + 'm'; else
                    if (isNext('black')) message += '\u001b[' + colorCodes.black + 'm'; else
                        if (isNext('red')) message += '\u001b[' + colorCodes.red + 'm'; else
                            if (isNext('green')) message += '\u001b[' + colorCodes.green + 'm'; else
                                if (isNext('yellow')) message += '\u001b[' + colorCodes.yellow + 'm'; else
                                    if (isNext('blue')) message += '\u001b[' + colorCodes.blue + 'm'; else
                                        if (isNext('magenta')) message += '\u001b[' + colorCodes.magenta + 'm'; else
                                            if (isNext('cyan')) message += '\u001b[' + colorCodes.cyan + 'm'; else
                                                if (isNext('white')) message += '\u001b[' + colorCodes.white + 'm'; else
                                                    if (isNext('gray')) message += '\u001b[' + colorCodes.gray + 'm'; else
                                                        if (isNext('grey')) message += '\u001b[' + colorCodes.grey + 'm';

            } else if (c == 'H') {
                // SHA
                message += commit.id;
            } else if (c == 'h') {
                // SHA
                message += commit.id.substring(0, 7);
            } else if (c == 's') {
                // Title
                message += commit.message.split('\n').shift();
            } else if (c == 'b') {
                // Body
                message += commit.message;
            } else if (c == 'a') {
                // Author
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
            } else if (c == 'c') {
                // Committer
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
            } else if (c == 'n') {
                // New line
                message += '\n';
            } else if (c == '%') {
                // %
                message += '%';
            }
            special = false;
            continue;
        }
        special = true;
    }
    return message;
}