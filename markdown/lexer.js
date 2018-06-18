// This parser follows the technique presented in a talk by Rob Pike in August 2011.
// Lexical Scanning in Go - Rob Pike
// Talk: https://www.youtube.com/watch?v=HxaD_trXwRE
// Slides: https://talks.golang.org/2011/lex.slide#1

// I am just a beginner in this field, who is exploring what lexing and parsing
// is about, by building my own lexer and parser.
// This could help: https://github.github.com/gfm/#appendix-a-parsing-strategy
import { items } from './items.js'

// Tokens
const eof = 0
const oneAstrisk = "*"      // italic
const twoAstrisks = "**"    // bold
const leftBracket = "["
const bang = "!"
const newline = "\n"
const heading = "#"
const threeBackTicks = "```"
const backtick = "`"

// Regexp
const linkRegexp = /\[(.*)\]\((.+)\)/
const imgRegexp  = /\!\[(.*)\]\((.+)\)/

class Item {
    constructor(typ, val) {
        this.typ = typ
        this.val = val
    }

    String() {
        let typ = this.typ
        // switch (this.typ) {
        //     case itemError: typ = "Error"; break
        //     case itemText: typ = "Text"; break
        return `${this.val} <${typ}>`
    }
}

export class Lexer {
    constructor(input) {
        this.input = input
        this.state = this.lexText
        this.items = []
        this.start = 0
        this.pos = 0
    }

    run() {
        for(let state = this.state; state != null;) {
            state = state.call(this)
        }
    }

    emit(typ) {
        this.items.push(new Item(typ, this.input.substring(this.start, this.pos)))
        this.start = this.pos
    }

    error(msg) {
        this.items.push(new Item(items.Error, 'Lex error: ' + msg))
        return null;
    }

    // Next returns the next rune in the input.
    next() {
        this.pos++
        if (this.pos >= this.input.length) {
            return eof
        }
        return this.input[this.pos]
    }

    // igonre
    ignore() {
        this.start = this.pos
    }

    ignoreNext() {
        this.pos++
        this.start = this.pos
    }
    
    // backup steps back one rune.
    // Can be called only once per call of next.
    backup() {
        this.pos--
    }

    // peek returns but does not consume
    // the next rune in the input.
    peek() {
        const r = this.next()
        this.backup()
        return r
    }

    // accept peeks and determines if it belongs to a charset
    accept(charset) {
        let r = this.next() 
        if (charset.includes(r)) {
            return true
        }
        this.backup()
        return false
    }

    // acceptRun
    acceptRun(charset) {
        let r = this.next()
        while(charset.includes(r)) {
            r = this.next()
        }
        this.backup()
    }

    // pop backtracks.
    pop() {
        let i = this.items.pop()
        this.start -= i.val.length
    }


    lexText() {
        while(true) {
            const nextText = this.input.substring(this.pos)
            if (nextText.startsWith(twoAstrisks)) {
                this.emit(items.Text)
                return this.lexStartBold

            } else if (nextText.startsWith(oneAstrisk)) {
                this.emit(items.Text)
                return this.lexStartItalic
            
            } else if (nextText.startsWith(newline)) {
                this.emit(items.Text)
                return this.lexNewline
                
            } else if (this.pos == 0 && nextText.startsWith(heading)) {
                return this.lexHeading

            } else if (nextText.startsWith(leftBracket)) {
                this.emit(items.Text)
                return this.lexLink
                
            } else if (nextText.startsWith(bang)) {
                this.emit(items.Text)
                return this.lexImg

            } else if (nextText.startsWith(threeBackTicks)) {
                this.emit(items.Text)
                return this.lexCodeBlock

            } else if (nextText.startsWith(backtick)) {
                this.emit(items.Text)
                return this.lexCode
            }
            
            const r = this.next()
            switch(r) {
                case eof: {
                    this.pos++
                    this.emit(items.Text)
                    return this.lexEOF;
                }
            }
        }
    }


    lexCode() {
        this.ignoreNext()
        let idxNewline = this.input.indexOf(newline, this.pos)
        let idxBacktick = this.input.indexOf(backtick, this.pos)
        if (idxNewline > idxBacktick) {
            this.pos += this.input.substring(this.pos, idxBacktick).length
            this.emit(items.Code)
            this.ignoreNext()
        }
        return this.lexText;
    }

    lexLink() {
        let sub = this.input.substring(this.pos)
        if (sub.search(linkRegexp) === 0) {
            let [_, title, link] = sub.match(linkRegexp)
            this.items.push(new Item(items.Link, {title, link}))
            this.start = this.pos = this.input.indexOf(')', this.pos) + 1
        }
        return this.lexText
    }

    lexImg() {
        let sub = this.input.substring(this.pos)
        if (sub.search(imgRegexp) === 0) {
            let [_, title, link] = sub.match(imgRegexp)
            this.items.push(new Item(items.Img, {title, link}))
            this.start = this.pos = this.input.indexOf(')', this.pos) + 1
        }
        return this.lexText
    }

    lexStartBold() {
        this.pos += twoAstrisks.length;
        this.emit(items.StartBold)
        return this.lexInsideBold
    }

    lexInsideBold() {
        while(true) {
            const nextText = this.input.substring(this.pos)
            if (nextText.startsWith(oneAstrisk)) {
                this.emit(items.Text)
                return this.lexEndBold
            }
            
            const r = this.next()
            switch(r) {
                case '\n': {
                    this.pop()
                    this.emit(items.Text)
                    return this.lexNewline;
                }
                case eof: {
                    this.pop()
                    this.emit(items.Text)
                    return this.lexEOF;
                }
            }
        }
    }

    lexEndBold() {
        this.pos += twoAstrisks.length;
        this.emit(items.EndBold)
        return this.lexText
    }

    lexStartItalic() {
        this.pos += oneAstrisk.length;
        this.emit(items.StartItalic)
        return this.lexInsideItalic
    }

    lexInsideItalic() {
        while(true) {
            const nextText = this.input.substring(this.pos)
            if (nextText.startsWith(oneAstrisk)) {
                this.emit(items.Text)
                return this.lexEndItalic

            }
            
            const r = this.next()
            switch(r) {
                case '\n': {
                    this.pop()
                    this.emit(items.Text)
                    return this.lexNewline;
                }
                case eof: {
                    this.pop()
                    this.emit(items.Text)
                    return this.lexEOF;
                }
            }
        }
    }

    lexEndItalic() {
        this.pos += oneAstrisk.length;
        this.emit(items.EndItalic)
        return this.lexText
    }

    lexNewline() {
        return this.lexAfterNewline()
    }

    lexLinebreak() {
        this.acceptRun('\n')
        this.emit(items.Linebreak)
        return this.lexAfterNewline()
    }

    lexAfterNewline() {
        const r = this.next()
        this.ignore()
        switch(r) {
            case heading: return this.lexHeading;
            case newline: return this.lexLinebreak;
            case eof: return this.lexEOF;
            default: {
                if (r.search(/\d/) !== -1) {
                    return this.lexOrderedListItem;
                } else if (r.search(/\-|\+|\*/) !== -1) {
                    return this.lexUnorderedListItem;
                }
                return this.lexText;
            }
        }
    }

    lexOrderedListItem() {
        this.acceptRun("1234567890.)- ")
        this.ignore()
        while(true) {
            const r = this.next()
            switch(r) {
                case '\n': {
                    this.emit(items.OrderedListItem)
                    return this.lexNewline
                }

                case eof: {
                    this.emit(items.OrderedListItem)
                    return this.lexEOF;
                }
            }
        }
    }

    lexUnorderedListItem() {
        let r = this.next()
        this.ignore()
        while(true) {
            r = this.next()
            switch(r) {
                case newline: {
                    this.emit(items.UnorderedListItem)
                    return this.lexNewline
                }

                case eof: {
                    this.emit(items.UnorderedListItem)
                    return this.lexEOF;
                }
            }
        }
    }

    lexCodeBlock() {
        this.pos += threeBackTicks.length
        this.ignore()
        let idx = this.input.indexOf('\n', this.pos)
        let lang = this.input.substring(this.pos, idx)
        this.pos = idx + 1;
        idx = this.input.indexOf('\n'+threeBackTicks, this.pos)
        let code = this.input.substring(this.pos, idx)
        
        this.items.push(new Item(items.CodeBlock, {code, lang}))
        this.start = this.pos = idx + 1 + threeBackTicks.length

        return this.lexText
    }

    lexHeading() {
        let sub = this.input.substring(this.pos);
        let idx = sub.indexOf('\n');
        if (idx >= 0) {
            let count = countConsecutive(sub, heading);
            this.start += count
            this.pos += idx;
            switch(count) {
                case 1: this.emit(items.H1); break
                case 2: this.emit(items.H2); break
                case 3: this.emit(items.H3); break
            }
        }
        return this.lexNewline
    }

    lexEOF() {
        this.emit(items.EOF)
        return null
    }
}

function countConsecutive(str, char) {
    let saw = false;
    let count = 0;
    for(let i = 0; i < str.length; i++) {
        if (saw === false) {
            if (str[i] === char) {
                saw = true;
            }
        }
        if (saw === true) {
            if (str[i] === char) {
                count++;
            } else {
                break
            }
        }
    }
    return count;
}


