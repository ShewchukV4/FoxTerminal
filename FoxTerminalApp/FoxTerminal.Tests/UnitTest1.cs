using FoxTerminal.Core;

namespace FoxTerminal.Tests;

public class UnitTest1
{
    [Fact]
    public void ParserWritesTextToBuffer()
    {
        var buffer = new TerminalBuffer(10, 3);
        var parser = new VtParser(buffer);

        parser.Feed("hi");

        var row = buffer.VisibleRows[0];
        Assert.Equal('h', row.Cells[0].Rune);
        Assert.Equal('i', row.Cells[1].Rune);
    }

    [Fact]
    public void ParserMovesCursorWithNewline()
    {
        var buffer = new TerminalBuffer(5, 2);
        var parser = new VtParser(buffer);

        parser.Feed("a\nb");

        Assert.Equal('a', buffer.VisibleRows[0].Cells[0].Rune);
        Assert.Equal('b', buffer.VisibleRows[1].Cells[0].Rune);
    }
}
